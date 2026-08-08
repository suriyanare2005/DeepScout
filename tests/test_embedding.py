import asyncio
import os
import sys
import uuid
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import httpx

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk
from backend.app.services.embedding import EmbeddingService

@pytest.mark.asyncio
async def test_live_embedding_generation_and_index():
    print("\n--- Running Live Embedding & Index Test ---")
    service = EmbeddingService()
    
    # 1. Test live vector generation
    texts = ["Test vector generation validation query."]
    vectors = await service.embed_batch(texts)
    
    assert len(vectors) == 1, "Failed to get vector output."
    vector = vectors[0]
    dimension = len(vector)
    print(f"Received embedding dimension: {dimension}")
    assert dimension == service.target_dimension, f"Expected {service.target_dimension} dimensions, got {dimension}"
    
    # 2. Insert into Neon database
    print("Connecting to Neon to test insertion and index search...")
    async with AsyncSessionLocal() as session:
        # Create temp entities
        company = Company(
            name="Temp Embedding Test LLC",
            website_url=f"https://temp-emb-{uuid.uuid4().hex[:8]}.example.com"
        )
        session.add(company)
        await session.flush()
        
        source = Source(
            company_id=company.id,
            url=f"{company.website_url}/about",
            indexing_status="completed"
        )
        session.add(source)
        await session.flush()
        
        doc = Document(
            company_id=company.id,
            source_id=source.id,
            cleaned_content="Mock doc content for embedding test."
        )
        session.add(doc)
        await session.flush()
        
        chunk = Chunk(
            company_id=company.id,
            source_id=source.id,
            document_id=doc.id,
            chunk_index=0,
            content="Embedding test content item.",
            embedding=None  # Start empty
        )
        session.add(chunk)
        await session.flush()
        await session.commit()
        
        try:
            # Generate and insert using our service method
            count = await service.embed_chunks([chunk], session, force=False)
            assert count == 1, "Expected 1 chunk to be embedded."
            
            # Verify the chunk now has the embedding saved in the DB
            await session.refresh(chunk)
            assert chunk.embedding is not None, "Embedding column was not updated in the database."
            assert len(chunk.embedding) == service.target_dimension
            print("   - SUCCESS: Real vector successfully saved to database.")
            
            # 3. Perform a similarity search query
            from sqlalchemy import select
            stmt = select(Chunk).order_by(Chunk.embedding.cosine_distance(vector)).limit(1)
            res = await session.execute(stmt)
            retrieved_chunk = res.scalars().first()
            
            assert retrieved_chunk is not None, "Failed to perform HNSW cosine distance search."
            assert retrieved_chunk.id == chunk.id
            print("   - SUCCESS: Cosine similarity matching retrieves the chunk correctly.")
            
        finally:
            # Cleanup
            print("Cleaning up database test records...")
            await session.delete(company)
            await session.commit()
            print("   - SUCCESS: Cleanup completed.")

@pytest.mark.asyncio
async def test_embedding_api_failure_handling():
    print("\n--- Running API Failure Handling Test ---")
    service = EmbeddingService()
    
    # Mock a non-retryable 400 Bad Request error
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = "Bad Request: Model not found"
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        
        with pytest.raises(ValueError) as exc_info:
            await service.embed_batch(["Test text"])
            
        assert "Embedding request failed with status 400" in str(exc_info.value)
        print("   - SUCCESS: Correctly raised ValueError on 400 Bad Request error.")

@pytest.mark.asyncio
async def test_embedding_retry_behavior():
    print("\n--- Running API Retry Behavior Test ---")
    service = EmbeddingService()
    
    # Simulate a transient 503 error, followed by a successful 200 response
    mock_resp_fail = MagicMock()
    mock_resp_fail.status_code = 503
    mock_resp_fail.text = "Service Unavailable"
    
    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 200
    
    # Structure of success response payload
    if service.provider == "gemini":
        mock_resp_success.json.return_value = {
            "embeddings": [{"values": [0.1] * service.target_dimension}]
        }
    else:
        mock_resp_success.json.return_value = {
            "data": [{"index": 0, "embedding": [0.1] * service.target_dimension}]
        }
        
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # First call returns 503, second returns 200
        mock_post.side_effect = [mock_resp_fail, mock_resp_success]
        
        with patch("backend.app.services.embedding.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            vectors = await service.embed_batch(["Retry test content."])
            
            assert len(vectors) == 1
            assert len(vectors[0]) == service.target_dimension
            # Check that client post was called twice and sleep was called once
            assert mock_post.call_count == 2
            mock_sleep.assert_called_once_with(1.0)
            print("   - SUCCESS: Correctly retried on 503 error and completed on second attempt.")

@pytest.mark.asyncio
async def test_duplicate_and_skip_embedded_chunks():
    print("\n--- Running Skip Already Embedded Test ---")
    service = EmbeddingService()
    
    # Set up mock chunks: chunk1 already has an embedding, chunk2 does not
    chunk1 = Chunk(content="Already embedded.", embedding=[0.2] * service.target_dimension)
    chunk2 = Chunk(content="Needs embedding.", embedding=None)
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    if service.provider == "gemini":
        mock_resp.json.return_value = {
            "embeddings": [{"values": [0.5] * service.target_dimension}]
        }
    else:
        mock_resp.json.return_value = {
            "data": [{"index": 0, "embedding": [0.5] * service.target_dimension}]
        }
        
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        
        # Test 1: embed_chunks with force=False (should skip chunk1 and only call API for chunk2)
        mock_db = MagicMock(spec=AsyncSession)
        count = await service.embed_chunks([chunk1, chunk2], mock_db, force=False)
        
        assert count == 1, "Should only embed 1 chunk."
        # API should be called with chunk2 text
        called_args, called_kwargs = mock_post.call_args
        called_payload = called_kwargs.get("json", {})
        if service.provider == "gemini":
            assert called_payload["requests"][0]["content"]["parts"][0]["text"] == "Needs embedding."
        else:
            assert called_payload["input"] == ["Needs embedding."]
            
        print("   - SUCCESS: Correctly skipped chunk1 which was already embedded.")
        
        # Test 2: embed_chunks with force=True (should regenerate both chunks)
        mock_post.reset_mock()
        # Mock payload for two chunks
        if service.provider == "gemini":
            mock_resp.json.return_value = {
                "embeddings": [
                    {"values": [0.7] * service.target_dimension},
                    {"values": [0.8] * service.target_dimension}
                ]
            }
        else:
            mock_resp.json.return_value = {
                "data": [
                    {"index": 0, "embedding": [0.7] * service.target_dimension},
                    {"index": 1, "embedding": [0.8] * service.target_dimension}
                ]
            }
            
        count_force = await service.embed_chunks([chunk1, chunk2], mock_db, force=True)
        assert count_force == 2, "Should regenerate embeddings for all chunks under force mode."
        assert mock_post.call_count == 1
        print("   - SUCCESS: Correctly recalculated both chunks when force=True is passed.")
