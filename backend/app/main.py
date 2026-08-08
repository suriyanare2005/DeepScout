import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings

# Setup logging config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("company_research_rag")

app = FastAPI(
    title="Company Research RAG API",
    description="Backend services for automated web crawling, index parsing, and ground Q&A.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "app": "Company Research RAG API",
        "version": "1.0.0"
    }

@app.get("/api/config-check")
async def config_check():
    """
    Utility endpoint for developer check-ups.
    Verifies which keys are loaded without exposing the actual token values.
    """
    return {
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "llm_provider": settings.LLM_PROVIDER,
        "reranker_provider": settings.RERANKER_PROVIDER,
        "has_firecrawl_key": settings.FIRECRAWL_API_KEY is not None,
        "has_openai_key": settings.OPENAI_API_KEY is not None,
        "has_gemini_key": settings.GEMINI_API_KEY is not None,
        "has_cohere_key": settings.COHERE_API_KEY is not None,
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
