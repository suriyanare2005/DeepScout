import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from backend.app.config import settings

logger = logging.getLogger("company_research_rag.db")

from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# Automatically swap postgresql:// to postgresql+asyncpg:// for async compatibility
if settings.DATABASE_URL.startswith("postgresql://"):
    async_db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    async_db_url = settings.DATABASE_URL

# Parse query params to check for SSL and strip them for asyncpg compatibility
parsed_url = urlparse(async_db_url)
query_params = dict(parse_qsl(parsed_url.query))

connect_args = {}
sslmode = query_params.get("sslmode", "")
if sslmode in ("require", "prefer", "allow") or "ssl" in query_params:
    connect_args["ssl"] = True

# Reconstruct URL completely without query parameters
async_db_url = urlunparse(parsed_url._replace(query=""))

# Create async engine with pool configuration suitable for serverless platforms like Neon
engine = create_async_engine(
    async_db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency generator for FastAPI endpoints to yield async database sessions.
    Automatically handles commit rollback and closing operations.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Database session error occurred: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()
