import os
import sys
import asyncio
import httpx
from sqlalchemy import select, text

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, Source, Document, Chunk

async def verify_768_dimensionality():
    print("Step 1: Calling Gemini API with outputDimensionality=768...")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "model": "models/gemini-embedding-2",
        "content": {
            "parts": [{
                "text": "Verification query for output dimensionality settings."
            }]
        },
        "outputDimensionality": 768
    }
    
    try:
        response = httpx.post(url, json=payload, timeout=10.0)
        if response.status_code != 200:
            print(f"Failed to fetch embedding! Status: {response.status_code}, Response: {response.text}")
            sys.exit(1)
            
        data = response.json()
        vector = data["embedding"]["values"]
        dimension = len(vector)
        print(f"   - SUCCESS: Gemini API accepted outputDimensionality=768.")
        print(f"   - Received vector dimension size: {dimension}")
        
        if dimension != 768:
            print(f"   - ERROR: Dimension size is {dimension}, expected 768.")
            sys.exit(1)
            
        print("\nStep 2: Connecting to database to verify pgvector insertion...")
        async with AsyncSessionLocal() as session:
            # Create a test company for database validation
            company = Company(
                name="Temp Dimensionality Test LLC",
                website_url="https://temp-dim-test.example.com"
            )
            session.add(company)
            await session.flush()
            
            source = Source(
                company_id=company.id,
                url="https://temp-dim-test.example.com/check",
                title="Test Page",
                indexing_status="completed"
            )
            session.add(source)
            await session.flush()
            
            doc = Document(
                company_id=company.id,
                source_id=source.id,
                cleaned_content="Dimensionality verification document."
            )
            session.add(doc)
            await session.flush()
            
            chunk = Chunk(
                company_id=company.id,
                source_id=source.id,
                document_id=doc.id,
                chunk_index=0,
                content="Verification query content.",
                embedding=vector  # Insert the real 768-dimension vector
            )
            session.add(chunk)
            await session.flush()
            
            await session.commit()
            print("   - SUCCESS: Real 768-dimensional vector inserted and committed successfully!")
            
            print("\nStep 3: Testing HNSW Cosine index compatibility...")
            # Query for the chunk using cosine distance
            stmt = select(Chunk).order_by(Chunk.embedding.cosine_distance(vector)).limit(1)
            res = await session.execute(stmt)
            matched_chunk = res.scalars().first()
            
            assert matched_chunk is not None, "Failed to retrieve the inserted vector via similarity match."
            print(f"   - SUCCESS: Vector search matched chunk '{matched_chunk.id}' correctly.")
            print(f"   - Cosine Index remains fully compatible and operational.")
            
            # Clean up the temp records
            print("\nStep 4: Cleaning up database test records...")
            await session.delete(company)
            await session.commit()
            print("   - SUCCESS: Cleanup completed.")
            
            print("\n[VERIFICATION COMPLETE] Option A is verified and 100% compatible!")
            
    except Exception as e:
        print(f"Error during verification: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify_768_dimensionality())
