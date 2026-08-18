import asyncio
import os
import sys
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from unittest.mock import patch

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk
from backend.app.services.embedding import EmbeddingService
from backend.app.services.retrieval import RetrievalService

@pytest.mark.asyncio
async def test_retrieval_service_queries():
    print("\n--- Running Retrieval Service Test ---")
    
    # 1. Initialize services
    embedding_service = EmbeddingService()
    retrieval_service = RetrievalService(embedding_service=embedding_service)
    
    # Target dimension from models
    dim = embedding_service.target_dimension
    
    # 2. Connect to database and insert structured test content
    async with AsyncSessionLocal() as session:
        # Create temp entities
        unique_id = uuid.uuid4().hex[:8]
        company = Company(
            name=f"Acme Retrieval Test LLC {unique_id}",
            website_url=f"https://acme-retrieval-{unique_id}.example.com"
        )
        session.add(company)
        await session.flush()
        
        source = Source(
            company_id=company.id,
            url=f"{company.website_url}/offerings",
            title="Our Solutions | Acme",
            source_type="product",
            indexing_status="completed"
        )
        session.add(source)
        await session.flush()
        
        doc = Document(
            company_id=company.id,
            source_id=source.id,
            cleaned_content="Mock doc content for retrieval test."
        )
        session.add(doc)
        await session.flush()
        
        # We define two chunks with highly distinct topics and mock embeddings
        vec_ai = [0.0] * dim
        vec_ai[0] = 0.95  # Direction for AI
        
        chunk_ai = Chunk(
            company_id=company.id,
            source_id=source.id,
            document_id=doc.id,
            chunk_index=0,
            section_header="## AI Agents",
            content="We build enterprise-grade artificial intelligence agents using large language models.",
            embedding=vec_ai
        )
        session.add(chunk_ai)
        
        vec_quantum = [0.0] * dim
        vec_quantum[1] = 0.95  # Direction for Quantum (orthogonal to AI)
        
        chunk_quantum = Chunk(
            company_id=company.id,
            source_id=source.id,
            document_id=doc.id,
            chunk_index=1,
            section_header="## Quantum Computing",
            content="We specialize in secure quantum hardware engineering and superconducting qubits.",
            embedding=vec_quantum
        )
        session.add(chunk_quantum)
        await session.commit()
        
        try:
            # 3. Test Lexical Search (Keyword FTS)
            # Querying "intelligence" should return chunk_ai
            lexical_results = await retrieval_service.retrieve_lexical("intelligence", company.id, session)
            assert len(lexical_results) > 0, "FTS returned no results."
            assert "artificial intelligence" in lexical_results[0].content
            print("   - SUCCESS: Lexical FTS correctly matched keywords.")
            
            # 4. Test Semantic Vector Search
            # Querying vector close to vec_ai should return chunk_ai
            query_vector_ai = [0.0] * dim
            query_vector_ai[0] = 0.8
            
            # Mock the embed_batch to return our test query vector
            with patch.object(embedding_service, "embed_batch", return_value=[query_vector_ai]):
                semantic_results = await retrieval_service.retrieve_semantic("query about AI", company.id, session)
                assert len(semantic_results) > 0, "Semantic search returned no results."
                assert "artificial intelligence" in semantic_results[0].content
                print("   - SUCCESS: Semantic pgvector search correctly matched embeddings.")
            
            # 5. Test Hybrid Search (RRF)
            # Mock embed_batch for query
            with patch.object(embedding_service, "embed_batch", return_value=[query_vector_ai]):
                hybrid_results = await retrieval_service.retrieve_hybrid("artificial intelligence", company.id, session, limit=1)
                assert len(hybrid_results) == 1, "Hybrid search did not return exactly 1 result as requested."
                assert "artificial intelligence" in hybrid_results[0]["content"]
                # Verify source metadata mapping
                assert hybrid_results[0]["source_url"] == source.url
                assert hybrid_results[0]["source_title"] == source.title
                assert hybrid_results[0]["source_type"] == "product"
                print("   - SUCCESS: Hybrid RRF correctly merged rankings and mapped source metadata.")
            
        finally:
            # Cleanup
            print("Cleaning up database test records...")
            await session.delete(company)
            await session.commit()
            from backend.app.db.session import engine
            await engine.dispose()
            print("   - SUCCESS: Cleanup completed.")

if __name__ == "__main__":
    from unittest.mock import patch
    asyncio.run(test_retrieval_service_queries())
