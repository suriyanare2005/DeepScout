import asyncio
import logging
import os
import sys
import uuid
from sqlalchemy import select, text

# Adjust paths to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk, VECTOR_DIMENSION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("company_research_rag.test_db")

async def run_db_tests():
    logger.info("Starting database verification test suite...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Clean up any leftover test companies from previous failed runs
            logger.info("Cleaning up leftovers from previous test runs...")
            await session.execute(text("DELETE FROM companies WHERE name LIKE 'Test Company LLC%';"))
            await session.commit()

            # Generate unique identifiers to avoid key conflicts on retries
            unique_suffix = uuid.uuid4().hex[:8]
            
            # 1. Create a test company
            logger.info("Step 1: Creating a test company...")
            test_company = Company(
                name=f"Test Company LLC {unique_suffix}",
                website_url=f"https://testcompany-{unique_suffix}.example.com"
            )
            session.add(test_company)
            await session.flush()  # Gen ID
            
            logger.info(f"   - Company created with ID: {test_company.id}")
            
            # 2. Create a test source record
            logger.info("Step 2: Creating a test source...")
            test_source = Source(
                company_id=test_company.id,
                url=f"https://testcompany-{unique_suffix}.example.com/about",
                title="About Us | Test Company",
                source_type="about",
                indexing_status="completed",
                raw_content="<html><body><h1>About Us</h1><p>We build beautiful software.</p></body></html>",
                content_hash="mock_hash_12345"
            )
            session.add(test_source)
            await session.flush()
            
            logger.info(f"   - Source created with ID: {test_source.id}")
            
            # 3. Create a test document
            logger.info("Step 3: Creating a test document...")
            test_doc = Document(
                company_id=test_company.id,
                source_id=test_source.id,
                title="About Us | Test Company",
                cleaned_content="About Us. We build beautiful software."
            )
            session.add(test_doc)
            await session.flush()
            
            logger.info(f"   - Document created with ID: {test_doc.id}")
            
            # 4. Create a test chunk with an embedding vector
            logger.info(f"Step 4: Inserting a test chunk (Vector size: {VECTOR_DIMENSION})...")
            # Generate a unit vector of appropriate dimensions
            mock_embedding = [0.0] * VECTOR_DIMENSION
            mock_embedding[0] = 1.0  # Set first dimension to 1.0
            
            test_chunk = Chunk(
                company_id=test_company.id,
                source_id=test_source.id,
                document_id=test_doc.id,
                chunk_index=0,
                section_header="## About Us",
                content="We build beautiful software and deploy secure RAG pipelines.",
                embedding=mock_embedding
            )
            session.add(test_chunk)
            await session.flush()
            
            logger.info(f"   - Chunk created with ID: {test_chunk.id}")
            
            # Commit the inserts
            await session.commit()
            logger.info("   - Transaction committed successfully.")
            
            # 5. Perform a vector similarity search
            logger.info("Step 5: Testing vector similarity search...")
            # Query vector close to mock_embedding
            query_embedding = [0.0] * VECTOR_DIMENSION
            query_embedding[0] = 0.9
            
            # Using pgvector's cosine distance operator (<=>)
            stmt = select(Chunk).order_by(Chunk.embedding.cosine_distance(query_embedding)).limit(1)
            result = await session.execute(stmt)
            retrieved_chunk = result.scalars().first()
            
            assert retrieved_chunk is not None, "Failed to retrieve chunk via vector search"
            logger.info(f"   - SUCCESS: Chunk '{retrieved_chunk.id}' retrieved successfully!")
            logger.info(f"     Content: '{retrieved_chunk.content}'")
            
            # 6. Perform a full-text search
            logger.info("Step 6: Testing PostgreSQL lexical full-text search...")
            fts_query = "RAG & pipelines"
            fts_stmt = select(Chunk).where(
                text("to_tsvector('english', content) @@ to_tsquery('english', :query)")
            )
            
            fts_result = await session.execute(fts_stmt, {"query": fts_query})
            fts_chunk = fts_result.scalars().first()
            
            assert fts_chunk is not None, "Failed to retrieve chunk via lexical FTS"
            logger.info(f"   - SUCCESS: Chunk retrieved via full-text search query '{fts_query}'!")
            logger.info(f"     Content: '{fts_chunk.content}'")
            
            # 7. Cleanup
            logger.info("Step 7: Cleaning up test records...")
            # Deleting the company will cascade delete all other records due to ForeignKey ondelete="CASCADE"
            await session.delete(test_company)
            await session.commit()
            logger.info("   - Cleanup transaction committed successfully.")
            
            logger.info("All database verification tests passed successfully!")
            
        except Exception as e:
            logger.error(f"Database test failed: {e}")
            await session.rollback()
            sys.exit(1)
        finally:
            from backend.app.db.session import engine
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_db_tests())
