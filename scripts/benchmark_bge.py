"""
BGE Embedding Benchmark & Quality Diagnostic Script
Model: BAAI/bge-base-en-v1.5
Target Dimension: 768
"""
import sys
import time
import asyncio
import torch
from sentence_transformers import SentenceTransformer

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Chunk, Source
from sqlalchemy import select

def check_device():
    cuda_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "None"
    device = "cuda" if cuda_available else "cpu"
    return cuda_available, gpu_name, device

async def get_sample_chunks():
    async with AsyncSessionLocal() as session:
        stmt = select(Chunk).limit(100)
        res = await session.execute(stmt)
        chunks = list(res.scalars().all())
        return chunks

def main():
    print("=" * 60)
    print("BGE Embedding Model Diagnostic & Benchmark")
    print("=" * 60)
    
    # 1. Device Inspection
    cuda_avail, gpu_name, device = check_device()
    print(f"CUDA Available: {cuda_avail}")
    print(f"GPU Detected: {gpu_name}")
    print(f"Device Used: {device}")
    
    # 2. Model Loading
    print("\nLoading BAAI/bge-base-en-v1.5 model...")
    load_start = time.time()
    model = SentenceTransformer("BAAI/bge-base-en-v1.5", device=device)
    load_time = time.time() - load_start
    print(f"Model loaded in {load_time:.2f}s on {device}")
    
    # 3. Single Real Embedding & Dimension Check
    sample_text = "Tata Consultancy Services (TCS) is a global leader in IT services, consulting, and business solutions."
    test_vec = model.encode(sample_text, normalize_embeddings=True)
    actual_dim = len(test_vec)
    print(f"\nSingle Test Vector Dimension: {actual_dim}")
    print(f"Matches pgvector target (768): {actual_dim == 768}")
    
    if actual_dim != 768:
        print("CRITICAL: Vector dimension is NOT 768! Stopping benchmark.")
        return
        
    # 4. Fetch DB chunks or fallback to generated chunks for 100-chunk benchmark
    chunks = asyncio.run(get_sample_chunks())
    if chunks:
        texts = [c.content for c in chunks]
        print(f"\nFetched {len(texts)} real chunks from database.")
    else:
        print("\nNo database chunks found, generating 100 representative synthetic text chunks...")
        texts = [
            f"Chunk #{i}: TCS provides IT services, consulting and business solutions. Section {i % 5}. " + ("Sample corporate report paragraph content. " * 30)
            for i in range(100)
        ]
        
    # 5. Benchmark 100 chunks with batching
    batch_size = 32
    print(f"Benchmarking {len(texts)} chunks with batch_size={batch_size}...")
    
    bench_start = time.time()
    embeddings = model.encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)
    bench_time = time.time() - bench_start
    
    chunks_per_sec = len(texts) / bench_time if bench_time > 0 else 0
    est_500_chunks_sec = (500 / chunks_per_sec) if chunks_per_sec > 0 else 0
    
    print("\n--- BENCHMARK RESULTS ---")
    print(f"Actual Vector Dimension : {actual_dim}")
    print(f"CUDA Available          : {cuda_avail}")
    print(f"GPU Detected            : {gpu_name}")
    print(f"Device Used             : {device}")
    print(f"Batch Size              : {batch_size}")
    print(f"Total Chunks Encoded    : {len(texts)}")
    print(f"Total Embedding Time    : {bench_time:.3f} s")
    print(f"Throughput              : {chunks_per_sec:.2f} chunks/sec")
    print(f"Estimated 500-chunk Time: {est_500_chunks_sec:.2f} s")
    print("-------------------------")

if __name__ == "__main__":
    main()
