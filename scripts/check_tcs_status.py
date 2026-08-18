import asyncio
import sys
from sqlalchemy import select

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, IngestionJob, Source, Chunk

async def check():
    async with AsyncSessionLocal() as session:
        comp_stmt = select(Company).where(Company.name.ilike("%tcs%") | Company.name.ilike("%tata%"))
        res = await session.execute(comp_stmt)
        companies = list(res.scalars().all())
        
        print(f"Found {len(companies)} TCS matching companies:")
        for c in companies:
            print(f"Company ID: {c.id}, Name: '{c.name}', URL: {c.website_url}")
            
            job_stmt = select(IngestionJob).where(IngestionJob.company_id == c.id).order_by(IngestionJob.created_at.desc())
            job_res = await session.execute(job_stmt)
            jobs = list(job_res.scalars().all())
            for j in jobs:
                print(f"  Job ID: {j.id}, Status: {j.status}, Pages Discovered: {j.pages_discovered}, Processed: {j.pages_processed}")
                if j.error_message:
                    print(f"  Error: {j.error_message}")
                    
            src_stmt = select(Source).where(Source.company_id == c.id)
            src_res = await session.execute(src_stmt)
            sources = list(src_res.scalars().all())
            print(f"  Sources count: {len(sources)}")
            
            chunk_stmt = select(Chunk).where(Chunk.company_id == c.id)
            chunk_res = await session.execute(chunk_stmt)
            chunks = list(chunk_res.scalars().all())
            print(f"  Chunks count: {len(chunks)}")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check())
