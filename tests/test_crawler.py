import asyncio
import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, IngestionJob
from backend.app.services.crawler import CrawlerService

@pytest.mark.asyncio
@patch("backend.app.services.crawler.FirecrawlApp")
async def test_crawler_service_flow(mock_firecrawl_class):
    # Setup mock Firecrawl response objects
    mock_app = MagicMock()
    mock_firecrawl_class.return_value = mock_app
    
    # Mock crawl_url(wait_until_done=False) to return a mock job ID
    mock_app.crawl_url.return_value = {"id": "mock-crawl-job-id-999"}
    
    # Mock check_crawl_status to simulate completed state
    mock_app.check_crawl_status.return_value = {
        "status": "completed",
        "total": 2,
        "completed": 2,
        "data": [
            {
                "url": "https://mockcompany.example.com",
                "markdown": "# Home Page\nWelcome to Mock Company.",
                "metadata": {"title": "Home | Mock Company"}
            },
            {
                "url": "https://mockcompany.example.com/about",
                "markdown": "# About Us\nWe are a mock company.",
                "metadata": {"title": "About | Mock Company"}
            },
            # Add a duplicate content block with a different URL to test duplicate filter
            {
                "url": "https://mockcompany.example.com/about-dup",
                "markdown": "# About Us\nWe are a mock company.",
                "metadata": {"title": "About | Mock Company"}
            }
        ]
    }
    
    # Initialize DB connection and create test entities
    async with AsyncSessionLocal() as session:
        # Create test company
        company = Company(
            name="Mock Ingestion Company",
            website_url="https://mockcompany.example.com"
        )
        session.add(company)
        await session.flush()
        
        # Create test ingestion job
        ingestion_job = IngestionJob(
            company_id=company.id,
            status="pending"
        )
        session.add(ingestion_job)
        await session.flush()
        await session.commit()
        
        try:
            # 1. Initialize crawler service
            crawler = CrawlerService()
            
            # 2. Trigger job start
            job_id = await crawler.start_crawl_job(company.website_url)
            assert job_id == "mock-crawl-job-id-999"
            mock_app.crawl_url.assert_called_once()
            
            # 3. Simulate polling loop and process results
            # Mock asyncio.sleep inside poll_and_process_crawl to avoid actual delays
            with patch("backend.app.services.crawler.asyncio.sleep", return_value=None):
                pages = await crawler.poll_and_process_crawl(
                    company_id=company.id,
                    job_id=job_id,
                    db=session,
                    ingestion_job_id=ingestion_job.id
                )
                
            assert len(pages) == 3
            
            # 4. Save results to sources and verify duplicate detection
            saved_sources = await crawler.save_pages_to_sources(
                company_id=company.id,
                pages=pages,
                db=session
            )
            
            # Should skip the duplicate block and only save 2 sources
            assert len(saved_sources) == 2
            assert saved_sources[0].url == "https://mockcompany.example.com"
            assert saved_sources[0].source_type == "general"
            assert saved_sources[1].url == "https://mockcompany.example.com/about"
            assert saved_sources[1].source_type == "about"
            
            # Recheck DB state
            job_record = await session.get(IngestionJob, ingestion_job.id)
            assert job_record.status == "running"  # updated during polling
            assert job_record.pages_processed == 2
            
        finally:
            # Cleanup database records
            await session.delete(company)
            await session.commit()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_crawler_service_flow())
