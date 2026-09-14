import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from firecrawl import FirecrawlApp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.config import settings
from backend.app.db.models import Source, IngestionJob

logger = logging.getLogger("company_research_rag.crawler")

class CrawlerService:
    def __init__(self):
        # Firecrawl requires a valid API key
        if not settings.FIRECRAWL_API_KEY:
            raise ValueError("FIRECRAWL_API_KEY is not configured in settings.")
        self.app = FirecrawlApp(api_key=settings.FIRECRAWL_API_KEY)

    async def start_crawl_job(self, target_url: str) -> str:
        """
        Initiates a background web crawl with Firecrawl and returns the job ID.
        """
        logger.info(f"Triggering async crawl via Firecrawl for domain: {target_url}")
        
        # Configure crawl parameters to traverse internal links up to depth 2
        params = {
            "limit": 20,             # Limit crawl scope for V1/dev budget
            "maxDepth": 2,           # Traverse root + 1 level deep links
            "allowBackwardLinks": False,
            "scrapeOptions": {
                "formats": ["markdown"],  # Get clean markdown content directly
                "onlyMainContent": False
            }
        }
        
        try:
            # Use wait_until_done=False to get the job ID immediately without blocking
            crawl_job = self.app.crawl_url(target_url, params=params, wait_until_done=False)
            job_id = crawl_job.get("id")
            if not job_id:
                raise ValueError(f"Failed to obtain job ID from Firecrawl response: {crawl_job}")
            logger.info(f"Successfully spawned Firecrawl crawl job: {job_id}")
            return job_id
        except Exception as e:
            logger.error(f"Error starting crawl job: {e}")
            raise

    async def poll_and_process_crawl(
        self, 
        company_id: str, 
        job_id: str, 
        db: AsyncSession, 
        ingestion_job_id: str
    ) -> list[dict]:
        """
        Polls Firecrawl job status, logs progress to DB, and returns the scraped pages list.
        """
        logger.info(f"Starting status polling loop for job {job_id}...")
        
        # Get the ingestion job record
        stmt = select(IngestionJob).where(IngestionJob.id == ingestion_job_id)
        res = await db.execute(stmt)
        job_record = res.scalar_one_or_none()
        
        if not job_record:
            logger.error(f"IngestionJob {ingestion_job_id} not found in database.")
            return []

        job_record.status = "running"
        job_record.logs = f"[{datetime.now(timezone.utc).isoformat()}] Started polling crawl job {job_id}.\n"
        await db.commit()

        poll_interval = 5  # Check every 5 seconds
        max_attempts = 60  # Timeout after 5 minutes
        attempts = 0
        
        while attempts < max_attempts:
            try:
                # Query Firecrawl status
                status_response = self.app.check_crawl_status(job_id)
                status = status_response.get("status")
                logger.info(f"Crawl job {job_id} status: {status}")
                
                # Update DB record with progress
                current_time = datetime.now(timezone.utc).isoformat()
                job_record.pages_discovered = status_response.get("total", 0)
                job_record.pages_processed = status_response.get("completed", 0)
                
                log_msg = f"[{current_time}] Status: {status}. Progress: {job_record.pages_processed}/{job_record.pages_discovered} pages.\n"
                job_record.logs = (job_record.logs or "") + log_msg
                await db.commit()

                if status == "completed":
                    logger.info(f"Crawl job {job_id} completed successfully!")
                    return status_response.get("data", [])
                
                elif status in ("failed", "cancelled"):
                    err_msg = status_response.get("error", "Unknown crawler error.")
                    logger.error(f"Crawl job {job_id} finished with status: {status}. Error: {err_msg}")
                    job_record.status = "failed"
                    job_record.error_message = err_msg
                    await db.commit()
                    return []
                    
            except Exception as e:
                logger.warning(f"Error checking status for crawl job {job_id}: {e}")
                # Don't fail immediately, try again in next poll
                
            await asyncio.sleep(poll_interval)
            attempts += 1
            
        # Timeout reached
        err_msg = "Crawl job timed out after 5 minutes."
        logger.error(err_msg)
        job_record.status = "failed"
        job_record.error_message = err_msg
        await db.commit()
        return []

    def determine_source_type(self, url: str) -> str:
        """
        Classifies page source types based on URL path conventions.
        """
        url_lower = url.lower()
        if any(keyword in url_lower for keyword in ["/about", "/company", "/team"]):
            return "about"
        elif any(keyword in url_lower for keyword in ["/careers", "/jobs", "/join"]):
            return "careers"
        elif any(keyword in url_lower for keyword in ["/product", "/service", "/pricing", "/solutions"]):
            return "product"
        elif any(keyword in url_lower for keyword in ["/blog", "/news", "/press"]):
            return "blog"
        elif any(keyword in url_lower for keyword in ["/contact", "/locations", "/offices"]):
            return "locations"
        return "general"

    async def save_pages_to_sources(
        self, 
        company_id: str, 
        pages: list[dict], 
        db: AsyncSession
    ) -> list[Source]:
        """
        Processes scraped pages, filters duplicates using cryptographic hashes,
        and saves unique records into the database.
        """
        saved_sources = []
        duplicate_count = 0
        
        for page in pages:
            # Firecrawl v1: URL lives inside metadata, not at the top level
            metadata = page.get("metadata", {})
            url = metadata.get("url") or metadata.get("sourceURL") or page.get("url")
            markdown_content = page.get("markdown", "")
            title = metadata.get("title", "Untitled Page")
            
            if not url or not markdown_content:
                logger.warning("Skipping page with empty url or content.")
                continue
                
            # Compute cryptographic hash of the content to skip exact duplicate pages
            content_hash = hashlib.sha256(markdown_content.encode("utf-8")).hexdigest()
            
            # Check if this content hash already exists for this company
            stmt = select(Source).where(
                Source.company_id == company_id,
                Source.content_hash == content_hash
            )
            res = await db.execute(stmt)
            existing_source = res.scalar_one_or_none()
            
            if existing_source:
                logger.info(f"Skipping duplicate content found for url: {url} (already matches {existing_source.url})")
                duplicate_count += 1
                continue
                
            # Define new source
            source = Source(
                company_id=company_id,
                url=url,
                title=title,
                source_type=self.determine_source_type(url),
                indexing_status="completed",
                raw_content=markdown_content,
                content_hash=content_hash,
                retrieval_timestamp=datetime.now(timezone.utc)
            )
            db.add(source)
            saved_sources.append(source)
            
        await db.commit()
        logger.info(f"Ingested {len(saved_sources)} pages successfully. Skipped {duplicate_count} duplicates.")
        return saved_sources
