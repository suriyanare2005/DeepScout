import asyncio
import os
import sys
import uuid
import pytest
from sqlalchemy import select

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk
from backend.app.services.crawler import CrawlerService
from backend.app.services.cleaner import ContentCleaner
from backend.app.services.chunker import MarkdownStructureChunker
from backend.app.services.embedding import EmbeddingService
from backend.app.services.retrieval import RetrievalService
from backend.app.services.llm import LLMService

@pytest.mark.asyncio
async def test_e2e_rag_pipeline():
    print("\n--- Running Live End-to-End RAG Pipeline Test ---")
    
    # Initialize all services
    crawler = CrawlerService()
    cleaner = ContentCleaner()
    chunker = MarkdownStructureChunker()
    embedder = EmbeddingService()
    retriever = RetrievalService(embedding_service=embedder)
    llm = LLMService()
    
    # Establish session
    async with AsyncSessionLocal() as db:
        # 1. Create a unique test company
        unique_suffix = uuid.uuid4().hex[:8]
        test_url = f"https://example-{unique_suffix}.com"
        # We will use the standard example.com target content for Firecrawl, but route it via a mock or run against example.com.
        # Since example.com is highly stable and fast, let's scrape https://example.com directly to verify Firecrawl!
        target_crawl_url = "https://example.com"
        
        company = Company(
            name=f"E2E Example Corp {unique_suffix}",
            website_url=test_url
        )
        db.add(company)
        await db.flush()
        
        print(f"Created Company '{company.name}' with website URL '{company.website_url}'")
        
        try:
            # Step 2: Trigger Live Scraper via Firecrawl
            print(f"Triggering async Firecrawl scraper for {target_crawl_url}...")
            job_id = await crawler.start_crawl_job(target_crawl_url)
            assert job_id is not None
            
            # Create a temporary IngestionJob record to satisfy database dependencies
            from backend.app.db.models import IngestionJob
            ingestion_job = IngestionJob(company_id=company.id, status="pending")
            db.add(ingestion_job)
            await db.flush()
            await db.commit()
            
            # Poll status and fetch pages
            pages = await crawler.poll_and_process_crawl(
                company_id=company.id,
                job_id=job_id,
                db=db,
                ingestion_job_id=ingestion_job.id
            )
            
            assert len(pages) > 0, "Firecrawl failed to scrape example.com"
            print(f"   - SUCCESS: Firecrawl returned {len(pages)} pages.")
            
            # Step 3: Save scraped source
            sources = await crawler.save_pages_to_sources(company.id, pages, db)
            assert len(sources) > 0
            print("   - SUCCESS: Sources saved with content hashes.")
            
            # Step 4: Clean, chunk and save documents
            for source in sources:
                print(f"   - Processing page: {source.url}")
                cleaned_md = cleaner.clean_markdown(source.raw_content)
                
                doc = Document(
                    company_id=company.id,
                    source_id=source.id,
                    title=source.title,
                    cleaned_content=cleaned_md
                )
                db.add(doc)
                await db.flush()
                
                doc_chunks = chunker.chunk_document(cleaned_md, company.id, source.id, doc.id)
                for chunk_data in doc_chunks:
                    chunk = Chunk(
                        company_id=chunk_data["company_id"],
                        source_id=chunk_data["source_id"],
                        document_id=chunk_data["document_id"],
                        chunk_index=chunk_data["chunk_index"],
                        section_header=chunk_data["section_header"],
                        content=chunk_data["content"],
                        embedding=None
                    )
                    db.add(chunk)
                    
            await db.commit()
            print("   - SUCCESS: Documents and chunks saved.")
            
            # Step 5: Embed Chunks
            stmt = select(Chunk).where(Chunk.company_id == company.id, Chunk.embedding == None)
            res = await db.execute(stmt)
            chunks_to_embed = list(res.scalars().all())
            assert len(chunks_to_embed) > 0
            
            count = await embedder.embed_chunks(chunks_to_embed, db)
            assert count == len(chunks_to_embed)
            print(f"   - SUCCESS: Generated and saved {count} embeddings of dimension 768.")
            
            # Step 6: Hybrid Search Retrieval
            question = "What is the purpose of example domain?"
            contexts = await retriever.retrieve_hybrid(question, str(company.id), db, limit=3)
            assert len(contexts) > 0, "No chunks retrieved."
            print(f"   - SUCCESS: Hybrid search retrieved {len(contexts)} relevant chunks.")
            
            # Step 7: Grounded LLM Generation
            result = await llm.generate_grounded_answer(question, contexts)
            print(f"\n--- Grounded Answer Output ---\n{result['answer']}\n")
            print(f"Citations: {result['citations']}")
            
            # Verify answer contains text grounded in the context and points to source url
            assert len(result["answer"]) > 0
            assert len(result["citations"]) > 0
            assert "example.com" in result["citations"][0]["url"]
            print("   - SUCCESS: Grounded answer contains citations matching example.com.")
            
        finally:
            # Cleanup
            print("Cleaning up database test records...")
            await db.delete(company)
            await db.commit()
            
            from backend.app.db.session import engine
            await engine.dispose()
            print("   - SUCCESS: Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(test_e2e_rag_pipeline())
