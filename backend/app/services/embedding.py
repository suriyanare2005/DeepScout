import asyncio
import logging
import torch
from sentence_transformers import SentenceTransformer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from backend.app.config import settings
from backend.app.db.models import Chunk

logger = logging.getLogger("company_research_rag.embedding")

class EmbeddingService:
    _bge_model = None

    def __init__(self):
        self.provider = settings.EMBEDDING_PROVIDER.lower()
        if self.provider == "gemini":
            self.model = settings.EMBEDDING_MODEL if "gemini" in settings.EMBEDDING_MODEL else "models/gemini-embedding-exp-03-07"
        else:
            self.model = settings.EMBEDDING_MODEL
        
        # We enforce exactly 768 dimensions for Gemini and BGE, 1536 for OpenAI
        if self.provider in ("bge", "bge_local", "bge-base", "gemini"):
            self.target_dimension = 768
        else:
            self.target_dimension = 1536
        
        if self.provider == "gemini" and not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for Gemini embeddings.")
        elif self.provider == "openai" and not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for OpenAI embeddings.")
        elif self.provider in ("bge", "bge_local", "bge-base"):
            if EmbeddingService._bge_model is None:
                device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(f"Initializing local BGE embedding model '{self.model}' on device: {device}...")
                EmbeddingService._bge_model = SentenceTransformer(self.model, device=device)
            self.local_model = EmbeddingService._bge_model

    async def _post_with_retry(self, client: httpx.AsyncClient, url: str, json_data: dict, headers: dict = None, max_retries: int = 5) -> dict:
        """
        Executes a POST request with exponential backoff retries for rate limits (429) and server errors (5xx).
        """
        backoff = 1.0
        for attempt in range(max_retries):
            try:
                response = await client.post(url, json=json_data, headers=headers, timeout=15.0)
                
                if response.status_code == 200:
                    return response.json()
                    
                # Retry on rate limiting or gateway/server errors
                if response.status_code == 429 or response.status_code >= 500:
                    logger.warning(
                        f"Transient error {response.status_code} from embedding provider. "
                        f"Retrying in {backoff}s... (Attempt {attempt + 1}/{max_retries})"
                    )
                else:
                    # Non-retryable error (e.g. 400 Bad Request, 401 Unauthorized)
                    raise ValueError(f"Embedding request failed with status {response.status_code}: {response.text}")
                    
            except httpx.RequestError as e:
                logger.warning(f"Network connection error: {e}. Retrying in {backoff}s... (Attempt {attempt + 1}/{max_retries})")
                
            await asyncio.sleep(backoff)
            backoff *= 2.0  # Exponential increase
            
        raise RuntimeError(f"Embedding API call failed after {max_retries} attempts.")

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Fetches embeddings in batch for a list of text strings.
        """
        if not texts:
            return []

        if self.provider in ("bge", "bge_local", "bge-base"):
            # Run local sentence transformer encode in threadpool to avoid blocking event loop
            def _encode():
                embeddings = self.local_model.encode(
                    texts, 
                    batch_size=32, 
                    normalize_embeddings=True, 
                    show_progress_bar=False
                )
                return [emb.tolist() for emb in embeddings]
            
            return await asyncio.to_thread(_encode)

        async with httpx.AsyncClient() as client:
            if self.provider == "gemini":
                # batchEmbedContents REST API path
                url = f"https://generativelanguage.googleapis.com/v1beta/{self.model}:batchEmbedContents?key={settings.GEMINI_API_KEY}"
                
                # Format request payload for Gemini batch API
                requests_payload = []
                for text_val in texts:
                    requests_payload.append({
                        "model": self.model,
                        "content": {
                            "parts": [{"text": text_val}]
                        },
                        "outputDimensionality": self.target_dimension
                    })
                    
                payload = {"requests": requests_payload}
                
                response_data = await self._post_with_retry(client, url, payload)
                
                vectors = []
                embeddings = response_data.get("embeddings", [])
                for emb in embeddings:
                    vector = emb.get("values", [])
                    vectors.append(vector)
                return vectors

            elif self.provider == "openai":
                url = "https://api.openai.com/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "input": texts,
                    "model": self.model
                }
                response_data = await self._post_with_retry(client, url, payload, headers=headers)
                
                vectors = []
                data = response_data.get("data", [])
                # OpenAI returns embeddings in order of inputs, but sorting is safer
                sorted_data = sorted(data, key=lambda x: x.get("index", 0))
                for item in sorted_data:
                    vectors.append(item.get("embedding", []))
                return vectors
                
            else:
                raise ValueError(f"Unsupported embedding provider: {self.provider}")

    async def embed_chunks(self, chunks: list[Chunk], db: AsyncSession, force: bool = False) -> int:
        """
        Generates and saves embeddings for all chunks in the list.
        Skips chunks that already have valid embeddings unless 'force' is True.
        """
        # Filter chunks that need embedding calculation
        chunks_to_embed = [c for c in chunks if c.embedding is None or force]
        if not chunks_to_embed:
            logger.info("No chunks need embedding calculation (already embedded).")
            return 0
            
        logger.info(f"Generating embeddings for {len(chunks_to_embed)} chunks using provider: {self.provider}...")
        
        # Batch requests in groups of 50 to avoid API/memory limits
        batch_size = 50
        embedded_count = 0
        
        for i in range(0, len(chunks_to_embed), batch_size):
            batch_chunks = chunks_to_embed[i:i+batch_size]
            batch_texts = [c.content for c in batch_chunks]
            
            # Fetch embeddings
            vectors = await self.embed_batch(batch_texts)
            
            if len(vectors) != len(batch_chunks):
                raise ValueError(
                    f"Mismatch in embeddings return count! "
                    f"Expected {len(batch_chunks)} vectors, received {len(vectors)}."
                )
                
            # Validate dimensions and assign
            for idx, vec in enumerate(vectors):
                vec_len = len(vec)
                if vec_len != self.target_dimension:
                    raise ValueError(
                        f"Vector dimension mismatch! Expected {self.target_dimension} "
                        f"dimensions, but API returned {vec_len} dimensions."
                    )
                batch_chunks[idx].embedding = vec
                
            embedded_count += len(batch_chunks)
            # Flush changes to DB periodically to avoid massive memory accumulation
            await db.commit()
            
        logger.info(f"Successfully processed and stored {embedded_count} embeddings.")
        return embedded_count
