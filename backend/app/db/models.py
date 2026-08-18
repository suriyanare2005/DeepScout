import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from backend.app.config import settings

Base = declarative_base()

# Enforce pgvector dimension of 768
VECTOR_DIMENSION = 768

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    website_url = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    sources = relationship("Source", back_populates="company", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="company", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="company", cascade="all, delete-orphan")
    ingestion_jobs = relationship("IngestionJob", back_populates="company", cascade="all, delete-orphan")
    research_questions = relationship("ResearchQuestion", back_populates="company", cascade="all, delete-orphan")

class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    source_type = Column(String, nullable=True)  # careers, product, blog, locations, about, general
    indexing_status = Column(String, default="pending", nullable=False)  # pending, completed, failed
    error_message = Column(Text, nullable=True)
    retrieval_timestamp = Column(DateTime(timezone=True), nullable=True)
    raw_content = Column(Text, nullable=True)  # Raw scraped HTML or markdown
    content_hash = Column(String, nullable=True)  # Hash of text content for duplicate checking
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="sources")
    documents = relationship("Document", back_populates="source", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="source", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=True)
    cleaned_content = Column(Text, nullable=False)  # Cleaned, boiler-plate stripped content
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="documents")
    source = relationship("Source", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    section_header = Column(String, nullable=True)  # Nearest markdown heading context
    content = Column(Text, nullable=False)
    embedding = Column(Vector(VECTOR_DIMENSION), nullable=True)  # Vector column
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="chunks")
    source = relationship("Source", back_populates="chunks")
    document = relationship("Document", back_populates="chunks")

class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)  # pending, running, completed, failed
    pages_discovered = Column(Integer, default=0, nullable=False)
    pages_processed = Column(Integer, default=0, nullable=False)
    pages_failed = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    logs = Column(Text, nullable=True)  # Crawler events log
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="ingestion_jobs")

class ResearchQuestion(Base):
    __tablename__ = "research_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)  # Retained source snippets JSON list
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="research_questions")
