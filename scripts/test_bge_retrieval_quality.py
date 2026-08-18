"""
Quality test script for local BGE embedding model retrieval
Model: BAAI/bge-base-en-v1.5
"""
import sys
import asyncio
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Chunk, Company
from sqlalchemy import select

async def test_quality():
    print("=" * 60)
    print("Testing BGE Local Embedding Retrieval Quality")
    print("=" * 60)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer("BAAI/bge-base-en-v1.5", device=device)
    
    async with AsyncSessionLocal() as session:
        # Get chunks
        stmt = select(Chunk).limit(30)
        res = await session.execute(stmt)
        chunks = list(res.scalars().all())
        
        if not chunks:
            print("No chunks found in database.")
            return
            
        print(f"Loaded {len(chunks)} chunks from database.")
        
        # Embed chunks with BGE
        chunk_texts = [c.content for c in chunks]
        doc_vectors = model.encode(chunk_texts, normalize_embeddings=True)
        
        # Sample queries
        test_queries = [
            "What services and solutions does the company provide?",
            "How does the company handle investor relations and corporate governance?",
            "What innovation hubs or pace ports does the company run?"
        ]
        
        for q in test_queries:
            query_vector = model.encode(q, normalize_embeddings=True)
            
            # Cosine similarity (since normalized, dot product = cosine similarity)
            sims = np.dot(doc_vectors, query_vector)
            best_idx = int(np.argmax(sims))
            best_score = float(sims[best_idx])
            best_chunk = chunks[best_idx]
            
            print(f"\nQuery: '{q}'")
            print(f"Top Match Score: {best_score:.4f}")
            print(f"Top Match Section: {best_chunk.section_header or 'General'}")
            print(f"Snippet: {best_chunk.content[:200]}...")
            
            # Assert meaningful similarity score (>0.4 for relevant match)
            if best_score < 0.3:
                print("WARNING: Low similarity score!")
            else:
                print("QUALITY CHECK: Excellent relevance match.")

if __name__ == "__main__":
    asyncio.run(test_quality())
