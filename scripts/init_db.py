import asyncio
import logging
import os
import sys
from sqlalchemy import text

# Adjust path to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.db.session import engine
from backend.app.db.models import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("company_research_rag.init_db")

async def init_db():
    logger.info("Initializing database tables and extensions...")
    
    async with engine.begin() as conn:
        # 1. Enable pgvector extension
        logger.info("Step 1: Enabling pgvector extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
        # 2. Create tables
        logger.info("Step 2: Creating schema tables...")
        # Since Base.metadata.create_all is a sync function, run it synchronously in the connection context
        await conn.run_sync(Base.metadata.create_all)
        
        # 3. Create indices
        logger.info("Step 3: Creating HNSW index for vector similarity search...")
        # HNSW index for cosine distance similarity
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx 
            ON chunks 
            USING hnsw (embedding vector_cosine_ops);
        """))
        
        logger.info("Step 4: Creating GIN index for lexical full-text search...")
        # GIN functional index on content using English dictionary
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS chunks_content_fts_idx 
            ON chunks 
            USING gin (to_tsvector('english', content));
        """))
        
        logger.info("Database initialization completed successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())
