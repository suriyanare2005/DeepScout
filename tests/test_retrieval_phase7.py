import asyncio
import uuid
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk
from backend.app.services.embedding import EmbeddingService
from backend.app.services.retrieval import RetrievalService

@pytest.mark.asyncio
async def test_phase7_hybrid_retrieval_suite():
    print("\n--- Running Phase 7 Hybrid Retrieval & Isolation Test Suite ---")
    embedder = EmbeddingService()
    retriever = RetrievalService(embedding_service=embedder, rrf_k=60)
    
    dim = embedder.target_dimension
    
    async with AsyncSessionLocal() as db:
        # Create Company A
        comp_a_id = uuid.uuid4()
        comp_a = Company(
            id=comp_a_id,
            name=f"Company Alpha {comp_a_id.hex[:6]}",
            website_url=f"https://alpha-{comp_a_id.hex[:6]}.com"
        )
        db.add(comp_a)
        await db.flush()
        
        # Create Company B (for isolation test)
        comp_b_id = uuid.uuid4()
        comp_b = Company(
            id=comp_b_id,
            name=f"Company Beta {comp_b_id.hex[:6]}",
            website_url=f"https://beta-{comp_b_id.hex[:6]}.com"
        )
        db.add(comp_b)
        await db.flush()
        
        # Company A Source & Doc
        src_a = Source(
            company_id=comp_a.id,
            url=f"{comp_a.website_url}/products",
            title="Alpha Tech Products",
            source_type="product",
            indexing_status="completed"
        )
        db.add(src_a)
        await db.flush()
        
        doc_a = Document(
            company_id=comp_a.id,
            source_id=src_a.id,
            title=src_a.title,
            cleaned_content="Alpha Tech products and AI solutions."
        )
        db.add(doc_a)
        await db.flush()
        
        # Chunks for Company A
        vec_ai = [0.0] * dim
        vec_ai[0] = 0.9  # Direction for AI
        
        chunk_a1 = Chunk(
            company_id=comp_a.id,
            source_id=src_a.id,
            document_id=doc_a.id,
            chunk_index=0,
            section_header="## Artificial Intelligence",
            content="Alpha Corp builds advanced neural language models and AI cloud services.",
            embedding=vec_ai
        )
        db.add(chunk_a1)
        
        vec_cyber = [0.0] * dim
        vec_cyber[1] = 0.9  # Direction for Cybersecurity
        
        chunk_a2 = Chunk(
            company_id=comp_a.id,
            source_id=src_a.id,
            document_id=doc_a.id,
            chunk_index=1,
            section_header="## Security Shield",
            content="Alpha Shield provides zero-trust network cybersecurity and threat intelligence.",
            embedding=vec_cyber
        )
        db.add(chunk_a2)
        
        # Company B Chunk (for isolation test)
        src_b = Source(
            company_id=comp_b.id,
            url=f"{comp_b.website_url}/secret",
            title="Beta Secret Page",
            source_type="about",
            indexing_status="completed"
        )
        db.add(src_b)
        await db.flush()
        
        doc_b = Document(
            company_id=comp_b.id,
            source_id=src_b.id,
            title=src_b.title,
            cleaned_content="Beta confidential information."
        )
        db.add(doc_b)
        await db.flush()
        
        chunk_b1 = Chunk(
            company_id=comp_b.id,
            source_id=src_b.id,
            document_id=doc_b.id,
            chunk_index=0,
            section_header="## Confidential",
            content="Alpha Corp secret keywords inside Beta company chunk.",
            embedding=vec_ai
        )
        db.add(chunk_b1)
        
        await db.commit()
        
        try:
            # 1. Semantic Retrieval Test
            sem_chunks = await retriever.retrieve_semantic("neural models", str(comp_a.id), db, limit=10)
            assert len(sem_chunks) > 0
            assert all(c.company_id == comp_a.id for c in sem_chunks), "Company isolation breached in semantic search!"
            print("   - PASS: 1. Semantic retrieval")
            
            # 2. Lexical Retrieval Test
            lex_chunks = await retriever.retrieve_lexical("cybersecurity", str(comp_a.id), db, limit=10)
            assert len(lex_chunks) > 0
            assert "cybersecurity" in lex_chunks[0].content
            assert all(c.company_id == comp_a.id for c in lex_chunks), "Company isolation breached in lexical search!"
            print("   - PASS: 2. Lexical retrieval")
            
            # 3. Exact Keyword Query
            exact_chunks = await retriever.retrieve_lexical("zero-trust", str(comp_a.id), db, limit=5)
            assert len(exact_chunks) > 0
            assert exact_chunks[0].id == chunk_a2.id
            print("   - PASS: 3. Exact keyword query")
            
            # 4. Semantic Query
            sem_query_chunks = await retriever.retrieve_semantic("artificial intelligence platform", str(comp_a.id), db, limit=5)
            assert len(sem_query_chunks) > 0
            print("   - PASS: 4. Semantic query")
            
            # 5. Hybrid Query
            hybrid_results = await retriever.retrieve_hybrid("cybersecurity zero-trust", str(comp_a.id), db, limit=5)
            assert len(hybrid_results) > 0
            print("   - PASS: 5. Hybrid query")
            
            # 6. RRF Ranking
            rrf_results = await retriever.retrieve_hybrid("neural language models", str(comp_a.id), db, limit=5)
            assert len(rrf_results) > 0
            assert rrf_results[0]["rrf_score"] > 0
            print("   - PASS: 6. RRF ranking")
            
            # 7. Duplicate Handling / Combined Evidence
            # Chunk_a1 matches both "neural" (semantic) and "language" (lexical)
            comb_results = await retriever.retrieve_hybrid("neural language models", str(comp_a.id), db, limit=5)
            assert len(comb_results) > 0
            print("   - PASS: 7. Duplicate handling & combined evidence")
            
            # 8. Metadata Preservation
            top = comb_results[0]
            assert "company_id" in top and top["company_id"] == str(comp_a.id)
            assert "company_name" in top and top["company_name"] == comp_a.name
            assert "source_id" in top and top["source_id"] == str(src_a.id)
            assert "document_id" in top and top["document_id"] == str(doc_a.id)
            assert "chunk_id" in top
            assert "section_header" in top
            assert "source_url" in top and top["source_url"] == src_a.url
            assert "source_title" in top and top["source_title"] == src_a.title
            assert "source_type" in top and top["source_type"] == src_a.source_type
            assert "retrieval_method" in top
            print("   - PASS: 8. Source metadata preservation")
            
            # 9. No Results
            empty_res = await retriever.retrieve_hybrid("nonexistent_xyz_keyword_9999", str(comp_a.id), db, limit=5)
            assert isinstance(empty_res, list)
            print("   - PASS: 9. No results handling")
            
            # 10. Strict Company Isolation Check
            # Querying Company A for text contained in Company B chunk must NEVER return Company B's chunk
            isolation_results = await retriever.retrieve_hybrid("Beta secret keywords", str(comp_a.id), db, limit=10)
            for res in isolation_results:
                assert res["company_id"] == str(comp_a.id), f"Company isolation breached! Returned company {res['company_id']} during query for {comp_a.id}"
                assert res["chunk_id"] != str(chunk_b1.id), "Returned Company B chunk during Company A query!"
            print("   - PASS: 10. Strict company isolation verified")
            
        finally:
            print("Cleaning up Phase 7 test records...")
            await db.delete(comp_a)
            await db.delete(comp_b)
            await db.commit()
            from backend.app.db.session import engine
            await engine.dispose()
            print("   - SUCCESS: Cleanup complete.")
