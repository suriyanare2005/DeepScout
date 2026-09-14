import logging
from datetime import datetime, timezone
from typing import List
from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.db.session import get_db, AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk, IngestionJob, ResearchQuestion
from backend.app.services.crawler import CrawlerService
from backend.app.services.cleaner import ContentCleaner
from backend.app.services.chunker import MarkdownStructureChunker
from backend.app.services.embedding import EmbeddingService
from backend.app.services.retrieval import RetrievalService
from backend.app.services.llm import LLMService

# Setup logging config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("company_research_rag")

app = FastAPI(
    title="Company Research RAG API",
    description="Backend services for automated web crawling, index parsing, and grounded Q&A.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schemas
class ResearchRequest(BaseModel):
    company_name: str
    company_url: str

class QueryRequest(BaseModel):
    company_id: str
    question: str

# Ingestion Pipeline background task orchestrator
async def run_ingestion_pipeline(company_id: str, ingestion_job_id: str, website_url: str):
    """
    Executes the ingestion pipeline in the background:
    Crawl (Firecrawl) -> Clean (boiler-plate strip) -> Chunk (structure-aware) -> Embed (Gemini 768) -> Store
    """
    logger.info(f"Background task triggered: Ingestion for company {company_id}, Job {ingestion_job_id}")
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch Job Record
            stmt = select(IngestionJob).where(IngestionJob.id == ingestion_job_id)
            res = await db.execute(stmt)
            job = res.scalar_one_or_none()
            if not job:
                logger.error(f"Background IngestionJob {ingestion_job_id} not found.")
                return

            job.logs = f"[{datetime.now(timezone.utc).isoformat()}] Starting ingestion pipeline...\n"
            await db.commit()

            # Initialize services
            crawler = CrawlerService()
            cleaner = ContentCleaner()
            chunker = MarkdownStructureChunker()
            embedder = EmbeddingService()

            # Step 1: Start crawl
            job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Initiating Firecrawl crawl job for {website_url}...\n"
            await db.commit()
            
            firecrawl_job_id = await crawler.start_crawl_job(website_url)
            
            # Step 2: Poll crawl status
            pages = await crawler.poll_and_process_crawl(
                company_id=company_id,
                job_id=firecrawl_job_id,
                db=db,
                ingestion_job_id=ingestion_job_id
            )
            
            if not pages:
                # Polling updates status to failed on errors
                logger.warning(f"Crawl job {firecrawl_job_id} returned no pages.")
                return
                
            # Step 3: Save unique sources (duplicate detection is handled internally via SHA-256)
            job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Crawling complete. Processing {len(pages)} unique pages...\n"
            await db.commit()
            
            sources = await crawler.save_pages_to_sources(company_id, pages, db)
            
            # Step 4: Clean, chunk and save documents
            for source in sources:
                job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Cleaning content for page: {source.url}\n"
                await db.commit()
                
                # Apply noise-stripping rules
                cleaned_content = cleaner.clean_markdown(source.raw_content)
                
                # Save clean document
                doc = Document(
                    company_id=company_id,
                    source_id=source.id,
                    title=source.title,
                    cleaned_content=cleaned_content
                )
                db.add(doc)
                await db.flush() # Yield doc.id
                
                # Chunk document tracking H1/H2/H3 headers hierarchy
                doc_chunks = chunker.chunk_document(
                    markdown_content=cleaned_content,
                    company_id=company_id,
                    source_id=source.id,
                    document_id=doc.id
                )
                
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
            
            # Step 5: Embed chunks (using outputDimensionality=768)
            job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Generating vector embeddings for chunks...\n"
            await db.commit()
            
            # Fetch chunks that need embedding calculation
            stmt = select(Chunk).where(Chunk.company_id == company_id, Chunk.embedding == None)
            res = await db.execute(stmt)
            chunks_to_embed = list(res.scalars().all())
            
            if chunks_to_embed:
                # Executes batch embeds with exponential backoff retries
                await embedder.embed_chunks(chunks_to_embed, db)
                
            # Step 6: Wrap up
            job.status = "completed"
            job.pages_processed = len(pages)
            job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Ingestion completed successfully!\n"
            await db.commit()
            logger.info(f"Ingestion pipeline completed for company {company_id}")
            
        except Exception as e:
            logger.exception("Error running ingestion job background pipeline")
            # Commit failure logs to DB using new connection to bypass failed transaction state
            async with AsyncSessionLocal() as error_db:
                stmt = select(IngestionJob).where(IngestionJob.id == ingestion_job_id)
                res = await error_db.execute(stmt)
                err_job = res.scalar_one_or_none()
                if err_job:
                    err_job.status = "failed"
                    err_job.error_message = str(e)
                    err_job.logs = (err_job.logs or "") + f"[{datetime.now(timezone.utc).isoformat()}] Fatal error: {str(e)}\n"
                    await error_db.commit()

# Core API Routes
@app.get("/")
async def root():
    return {
        "status": "healthy",
        "app": "Company Research RAG API",
        "version": "1.0.0"
    }

@app.get("/api/config-check")
async def config_check():
    """
    Utility endpoint for developer check-ups.
    Verifies which keys are loaded without exposing the actual token values.
    """
    return {
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "reranker_provider": settings.RERANKER_PROVIDER,
        "has_firecrawl_key": settings.FIRECRAWL_API_KEY is not None,
        "has_openai_key": settings.OPENAI_API_KEY is not None,
        "has_gemini_key": settings.GEMINI_API_KEY is not None,
        "has_cohere_key": settings.COHERE_API_KEY is not None,
    }

@app.post("/api/research", status_code=202)
async def trigger_research(
    req: ResearchRequest, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    url = req.company_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
        
    # Fetch or create company
    stmt = select(Company).where(Company.website_url == url)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    
    if not company:
        company = Company(name=req.company_name, website_url=url)
        db.add(company)
        await db.flush()
    else:
        # Update name if changed
        company.name = req.company_name
        await db.flush()
        
    # Create ingestion job tracker
    job = IngestionJob(company_id=company.id, status="pending")
    db.add(job)
    await db.flush()
    await db.commit()
    
    # Dispatch async pipeline worker
    background_tasks.add_task(
        run_ingestion_pipeline, 
        company_id=str(company.id), 
        ingestion_job_id=str(job.id), 
        website_url=url
    )
    
    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "job_id": str(job.id),
        "status": "pending"
    }

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(IngestionJob).where(IngestionJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found.")
        
    return {
        "job_id": str(job.id),
        "company_id": str(job.company_id),
        "status": job.status,
        "pages_discovered": job.pages_discovered,
        "pages_processed": job.pages_processed,
        "error_message": job.error_message,
        "logs": job.logs
    }

@app.post("/api/query")
async def query_company(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    # Verify company exists
    stmt = select(Company).where(Company.id == req.company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
        
    # Validate that we have chunk data for Q&A
    chunk_stmt = select(Chunk).where(Chunk.company_id == company.id).limit(1)
    chunk_res = await db.execute(chunk_stmt)
    has_chunks = chunk_res.scalars().first() is not None
    
    if not has_chunks:
        return {
            "answer": "This company has not been researched yet, or the ingestion job failed. Please research the company first.",
            "citations": []
        }
        
    # Initialize RAG Pipeline Services
    embedder = EmbeddingService()
    retriever = RetrievalService(embedding_service=embedder)
    llm = LLMService()
    
    # 1. Perform Hybrid Retrieval (RRF combining Cosine pgvector & GIN Lexical search)
    contexts = await retriever.retrieve_hybrid(
        query=req.question,
        company_id=str(company.id),
        db=db,
        limit=5
    )
    
    # 2. Call LLM to generate grounded answers and match citation mappings
    result = await llm.generate_grounded_answer(req.question, contexts)
    
    # 3. Save Question to DB history logs
    rq = ResearchQuestion(
        company_id=company.id,
        question=req.question,
        answer=result["answer"],
        citations=result["citations"]
    )
    db.add(rq)
    await db.commit()
    
    return {
        "answer": result["answer"],
        "citations": result["citations"]
    }

@app.get("/api/companies")
async def list_companies(db: AsyncSession = Depends(get_db)):
    stmt = select(Company).order_by(Company.name)
    res = await db.execute(stmt)
    companies = list(res.scalars().all())
    
    results = []
    for c in companies:
        # Query latest ingestion job status
        job_stmt = select(IngestionJob).where(IngestionJob.company_id == c.id).order_by(IngestionJob.created_at.desc()).limit(1)
        job_res = await db.execute(job_stmt)
        latest_job = job_res.scalar_one_or_none()
        
        results.append({
            "id": str(c.id),
            "name": c.name,
            "website_url": c.website_url,
            "status": latest_job.status if latest_job else "unknown",
            "created_at": c.created_at.isoformat()
        })
    return results

@app.delete("/api/companies/{company_id}", status_code=200)
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db)):
    """
    Deletes a company and ALL associated data:
    chunks, documents, sources, ingestion jobs, research history, and the company record.
    """
    from sqlalchemy import delete as sql_delete
    from backend.app.db.models import ResearchQuestion, Source, Document, Chunk, IngestionJob

    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    # Cascade-delete all related records in dependency order
    await db.execute(sql_delete(Chunk).where(Chunk.company_id == company_id))
    await db.execute(sql_delete(Document).where(Document.company_id == company_id))
    await db.execute(sql_delete(Source).where(Source.company_id == company_id))
    await db.execute(sql_delete(IngestionJob).where(IngestionJob.company_id == company_id))
    await db.execute(sql_delete(ResearchQuestion).where(ResearchQuestion.company_id == company_id))
    await db.delete(company)
    await db.commit()

    return {"deleted": True, "company_id": company_id}

@app.get("/api/companies/{company_id}/history")
async def get_company_history(company_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ResearchQuestion).where(ResearchQuestion.company_id == company_id).order_by(ResearchQuestion.created_at.desc())
    res = await db.execute(stmt)
    history = list(res.scalars().all())
    
    return [
        {
            "id": str(h.id),
            "question": h.question,
            "answer": h.answer,
            "citations": h.citations,
            "created_at": h.created_at.isoformat()
        }
        for h in history
    ]

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
