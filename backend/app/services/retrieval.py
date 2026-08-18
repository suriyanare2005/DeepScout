import logging
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.models import Chunk, Source, Company
from backend.app.services.embedding import EmbeddingService

logger = logging.getLogger("company_research_rag.retrieval")

class RetrievalService:
    def __init__(
        self, 
        embedding_service: EmbeddingService,
        semantic_top_k: int = 20,
        lexical_top_k: int = 20,
        final_top_k: int = 5,
        rrf_k: int = 60
    ):
        self.embedding_service = embedding_service
        self.semantic_top_k = semantic_top_k
        self.lexical_top_k = lexical_top_k
        self.final_top_k = final_top_k
        self.rrf_k = rrf_k

    async def retrieve_semantic(
        self, 
        query: str, 
        company_id: str, 
        db: AsyncSession, 
        limit: int | None = None
    ) -> list[Chunk]:
        """
        Retrieves chunks using pgvector semantic cosine distance matching.
        """
        effective_limit = limit or self.semantic_top_k
        logger.info(f"Executing semantic retrieval for company {company_id} (limit={effective_limit})...")
        try:
            # Generate vector embedding for the query using BGE
            query_vectors = await self.embedding_service.embed_batch([query])
            if not query_vectors:
                logger.warning("Empty query vector returned.")
                return []
            query_vector = query_vectors[0]
            
            # Select chunks ordered by cosine similarity, filtered strictly by company_id
            stmt = (
                select(Chunk)
                .where(Chunk.company_id == company_id, Chunk.embedding.isnot(None))
                .order_by(Chunk.embedding.cosine_distance(query_vector))
                .limit(effective_limit)
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
        limit: int | None = None
    ) -> list[Chunk]:
        """
        Retrieves chunks using PostgreSQL GIN full-text search index matching.
        """
        effective_limit = limit or self.lexical_top_k
        logger.info(f"Executing lexical FTS retrieval for company {company_id} (limit={effective_limit})...")
        try:
            # Use websearch_to_tsquery for natural queries
            stmt = (
                select(Chunk)
                .where(
                    Chunk.company_id == company_id,
                    text("to_tsvector('english', content) @@ websearch_to_tsquery('english', :query)")
                )
                .limit(effective_limit)
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
        limit: int | None = None,
        candidate_limit: int | None = None
    ) -> list[dict]:
        """
        Executes both semantic and lexical searches, combines results using
        Reciprocal Rank Fusion (RRF), and attaches source metadata details.
        Guarantees strict company isolation.
        """
        eff_final_limit = limit or self.final_top_k
        eff_cand_limit = candidate_limit or max(self.semantic_top_k, self.lexical_top_k)

        # Run semantic and lexical queries
        semantic_chunks = await self.retrieve_semantic(query, company_id, db, limit=eff_cand_limit)
        lexical_chunks = await self.retrieve_lexical(query, company_id, db, limit=eff_cand_limit)
        
        # Combine using Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        chunk_map = {}
        retrieval_methods = {}
        
        k = self.rrf_k
        
        # Process semantic ranks
        for rank, chunk in enumerate(semantic_chunks, start=1):
            chunk_id = chunk.id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
            retrieval_methods[chunk_id] = "semantic"
            
        # Process lexical ranks
        for rank, chunk in enumerate(lexical_chunks, start=1):
            chunk_id = chunk.id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
            if chunk_id in retrieval_methods:
                retrieval_methods[chunk_id] = "hybrid"
            else:
                retrieval_methods[chunk_id] = "lexical"
            
        # Sort chunks by RRF score descending
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        top_ids = sorted_ids[:eff_final_limit]
        
        if not top_ids:
            logger.info(f"No candidates found for query: '{query}' for company {company_id}")
            return []

        # Fetch company details
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_res = await db.execute(comp_stmt)
        company_obj = comp_res.scalar_one_or_none()
        company_name = company_obj.name if company_obj else "Unknown Company"
        
        # Compile result list with full source metadata preloaded
        results = []
        for c_id in top_ids:
            chunk = chunk_map[c_id]
            
            stmt = select(Source).where(Source.id == chunk.source_id)
            res = await db.execute(stmt)
            source = res.scalar_one_or_none()
            
            results.append({
                "chunk_id": str(chunk.id),
                "company_id": str(chunk.company_id),
                "company_name": company_name,
                "source_id": str(chunk.source_id),
                "document_id": str(chunk.document_id),
                "content": chunk.content,
                "section_header": chunk.section_header or "General",
                "rrf_score": rrf_scores[c_id],
                "retrieval_method": retrieval_methods.get(c_id, "unknown"),
                "source_url": source.url if source else "Unknown",
                "source_title": source.title if source else "Unknown Page",
                "source_type": source.source_type if source else "general"
            })
            
        logger.info(f"Hybrid search returned {len(results)} merged chunks for query: '{query}'")
        return results
