import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Base configuration
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str

    # API Keys
    FIRECRAWL_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    COHERE_API_KEY: str | None = None

    # Pipeline configurations
    EMBEDDING_PROVIDER: str = "bge"
    EMBEDDING_MODEL: str = "BAAI/bge-base-en-v1.5"
    LLM_PROVIDER: str = "gemini"
    LLM_MODEL: str = "models/gemini-3.6-flash"
    RERANKER_PROVIDER: str = "none"

    # Server configurations
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str | List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgresql+asyncpg://")
        return v

# Instantiate global settings
settings = Settings()
