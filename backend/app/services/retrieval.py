import logging
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.models import Chunk, Source
from backend.app.services.embedding import EmbeddingService

logger = logging.getLogger("company_research_rag.retrieval")

class RetrievalService:
    def __init__(self, embedding_service: EmbeddingService):
        self.embedding_service = embedding_service

    async def retrieve_semantic(
        self, 
        query: str, 
        company_id: str, 
        db: AsyncSession, 
        limit: int = 15
    ) -> list[Chunk]:
        """
        Retrieves chunks using pgvector semantic cosine distance matching.
        """
        logger.info(f"Executing semantic retrieval for company {company_id}...")
        try:
            # Generate vector embedding for the query
            query_vectors = await self.embedding_service.embed_batch([query])
            if not query_vectors:
                logger.warning("Empty query vector returned.")
                return []
            query_vector = query_vectors[0]
            
            # Select chunks ordered by cosine similarity
            stmt = (
                select(Chunk)
                .where(Chunk.company_id == company_id)
                .order_by(Chunk.embedding.cosine_distance(query_vector))
                .limit(limit)
            )
            res = await db.execute(stmt)
            chunks = list(res.scalars().all())
            logger.info(f"Retrieved {len(chunks)} semantic candidates.")
            return chunks
        except Exception as e:
            logger.error(f"Error during semantic retrieval: {e}")
            return []

    async def retrieve_lexical(
        self, 
        query: str, 
        company_id: str, 
        db: AsyncSession, 
        limit: int = 15
    ) -> list[Chunk]:
        """
        Retrieves chunks using PostgreSQL GIN full-text search index matching.
        """
        logger.info(f"Executing lexical FTS retrieval for company {company_id}...")
        try:
            # We use websearch_to_tsquery to handle natural search terms safely
            stmt = (
                select(Chunk)
                .where(
                    Chunk.company_id == company_id,
                    text("to_tsvector('english', content) @@ websearch_to_tsquery('english', :query)")
                )
                .limit(limit)
            )
            res = await db.execute(stmt, {"query": query})
            chunks = list(res.scalars().all())
            logger.info(f"Retrieved {len(chunks)} lexical candidates.")
            return chunks
        except Exception as e:
            logger.error(f"Error during lexical retrieval: {e}")
            return []

    async def retrieve_hybrid(
        self, 
        query: str, 
        company_id: str, 
        db: AsyncSession, 
        limit: int = 5,
        candidate_limit: int = 20
    ) -> list[dict]:
        """
        Executes both semantic and lexical searches, combines results using
        Reciprocal Rank Fusion (RRF), and attaches source metadata details.
        """
        # Run semantic and lexical queries
        semantic_chunks = await self.retrieve_semantic(query, company_id, db, limit=candidate_limit)
        lexical_chunks = await self.retrieve_lexical(query, company_id, db, limit=candidate_limit)
        
        # Combine using Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        chunk_map = {}
        
        # RRF constant parameter (k = 60 is standard in literature)
        k = 60
        
        # Process semantic ranks
        for rank, chunk in enumerate(semantic_chunks, start=1):
            chunk_id = chunk.id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
            
        # Process lexical ranks
        for rank, chunk in enumerate(lexical_chunks, start=1):
            chunk_id = chunk.id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
            
        # Sort chunks by RRF score descending
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        top_ids = sorted_ids[:limit]
        
        # Compile result list with source records preloaded for metadata tracing
        results = []
        for c_id in top_ids:
            chunk = chunk_map[c_id]
            
            # Fetch source URL and title details
            stmt = select(Source).where(Source.id == chunk.source_id)
            res = await db.execute(stmt)
            source = res.scalar_one_or_none()
            
            results.append({
                "chunk_id": str(chunk.id),
                "content": chunk.content,
                "section_header": chunk.section_header or "General",
                "rrf_score": rrf_scores[c_id],
                "source_url": source.url if source else "Unknown",
                "source_title": source.title if source else "Unknown Page",
                "source_type": source.source_type if source else "general"
            })
            
        logger.info(f"Hybrid search returned {len(results)} merged chunks for query: '{query}'")
        return results
