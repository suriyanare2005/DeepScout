"""
Resumable migration script to re-embed all database chunks using local BGE model.
Preserves all chunk metadata while updating pgvector embeddings to BGE.
"""
import sys
import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Chunk
from backend.app.services.embedding import EmbeddingService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reembed_bge")

async def reembed_all_chunks():
    logger.info("Starting BGE re-embedding migration...")
    
    # Ensure configuration uses BGE
    settings.EMBEDDING_PROVIDER = "bge"
    settings.EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
    
    embedder = EmbeddingService()
    
    async with AsyncSessionLocal() as db:
        # Fetch all chunks
        stmt = select(Chunk)
        res = await db.execute(stmt)
        all_chunks = list(res.scalars().all())
        total_chunks = len(all_chunks)
        
        logger.info(f"Found {total_chunks} total chunks in database to re-embed with BGE.")
        
        if total_chunks == 0:
            logger.info("No chunks in database. Migration finished.")
            return
            
        # Re-embed in force mode
        embedded_count = await embedder.embed_chunks(all_chunks, db, force=True)
        logger.info(f"Successfully re-embedded {embedded_count}/{total_chunks} chunks with BGE.")

if __name__ == "__main__":
    asyncio.run(reembed_all_chunks())
