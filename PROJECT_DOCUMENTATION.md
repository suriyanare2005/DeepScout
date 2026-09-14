# DeepScout — Complete Project Documentation

> **Version**: 1.0.0  
> **Author**: Suriya  
> **Last Updated**: September 2026  
> **Status**: Production-Ready

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Pipeline](#2-architecture--pipeline)
3. [Tech Stack — Complete List](#3-tech-stack--complete-list)
4. [Project File Structure](#4-project-file-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Database Schema](#7-database-schema)
8. [RAG Pipeline — Step by Step](#8-rag-pipeline--step-by-step)
9. [Environment Variables & Configuration](#9-environment-variables--configuration)
10. [How to Run](#10-how-to-run)
11. [API Endpoints](#11-api-endpoints)
12. [Problems Faced & How They Were Solved](#12-problems-faced--how-they-were-solved)
13. [Development Timeline (Git History)](#13-development-timeline-git-history)
14. [Key Design Decisions](#14-key-design-decisions)
15. [What I Learned](#15-what-i-learned)

---

## 1. Project Overview

**DeepScout** is a full-stack **Retrieval-Augmented Generation (RAG)** web application that lets users research any company by simply providing its name and website URL.

### What It Does
1. **Crawls** the company's entire website using Firecrawl API
2. **Cleans** the raw HTML/markdown by removing navigation, cookie banners, and boilerplate
3. **Chunks** the cleaned content into semantically meaningful blocks using heading-aware splitting
4. **Embeds** each chunk into a 768-dimensional vector using a local BGE model running on CUDA GPU
5. **Stores** the vectors in Neon PostgreSQL with the pgvector extension
6. **Retrieves** relevant chunks using hybrid search (cosine similarity + full-text search + RRF fusion)
7. **Generates** grounded, citation-backed answers using Google Gemini LLM

### Key Principle
> Every answer is **grounded in real, retrieved evidence** — not hallucinated from the model's training data. Every claim links back to a specific source page from the company's website.

---

## 2. Architecture & Pipeline

```
User enters company URL
        │
        ▼
┌─────────────────┐
│   FIRECRAWL      │  ← Web crawling API (up to 20 pages, depth 2)
│   Crawl Website  │
└────────┬────────┘
         │ Raw Markdown pages
         ▼
┌─────────────────┐
│   CONTENT        │  ← Strips cookies, nav bars, legal boilerplate,
│   CLEANER        │     social links, skip-to-content anchors
└────────┬────────┘
         │ Clean Markdown
         ▼
┌─────────────────┐
│   STRUCTURE-     │  ← Splits by H1/H2/H3 headings, respects
│   AWARE CHUNKER  │     semantic boundaries (800 chars, 150 overlap)
└────────┬────────┘
         │ Chunks with section_header metadata
         ▼
┌─────────────────┐
│   BGE EMBEDDER   │  ← BAAI/bge-base-en-v1.5, 768 dimensions
│   (Local CUDA)   │     Runs on NVIDIA RTX 3050 GPU
└────────┬────────┘
         │ 768d float vectors
         ▼
┌─────────────────┐
│   NEON           │  ← PostgreSQL + pgvector extension
│   PostgreSQL     │     Stores chunks + vectors + metadata
│   + pgvector     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│SEMANTIC│ │LEXICAL │  ← pgvector cosine distance + PostgreSQL FTS
│ SEARCH │ │  FTS   │     (websearch_to_tsquery)
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         │  Reciprocal Rank Fusion (RRF, k=60)
         ▼
┌─────────────────┐
│   TOP 5 CHUNKS   │  ← Merged, deduplicated, ranked by RRF score
└────────┬────────┘
         │ Context blocks with source metadata
         ▼
┌─────────────────┐
│   GEMINI LLM     │  ← gemini-3.6-flash via REST API
│   (Grounded Q&A) │     System prompt enforces citation rules
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   GROUNDED       │  ← Answer text + parsed [1][2][3] citations
│   ANSWER +       │     mapped back to source URLs, titles,
│   CITATIONS      │     sections, snippets, and RRF scores
└─────────────────┘
```

---

## 3. Tech Stack — Complete List

### Backend (Python)
| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.11 | Core language |
| **FastAPI** | 0.111.0 | Async REST API framework |
| **Uvicorn** | 0.30.1 | ASGI server |
| **SQLAlchemy** | 2.0.31 | Async ORM with asyncio support |
| **asyncpg** | 0.29.0 | Async PostgreSQL driver |
| **pgvector** | 0.3.1 | Vector similarity search extension for SQLAlchemy |
| **Pydantic** | 2.7.4 | Settings validation and request/response schemas |
| **pydantic-settings** | 2.3.3 | Environment variable loading from `.env` |
| **Firecrawl (firecrawl-py)** | 1.0.0 | Website crawling and markdown extraction |
| **httpx** | 0.27.0 | Async HTTP client for Gemini API calls |
| **sentence-transformers** | — | Local BGE embedding model runner |
| **PyTorch** | — | GPU tensor operations (CUDA backend) |
| **tiktoken** | 0.7.0 | Token counting utilities |

### Frontend (React)
| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2.8 | UI component library |
| **React Router DOM** | 7.18.2 | Multi-page SPA routing |
| **TypeScript** | 6.0.2 | Type-safe JavaScript |
| **Vite** | 8.2.0 | Build tool and dev server |
| **Tailwind CSS** | 3.4.19 | Utility-first CSS framework |
| **Lucide React** | 1.30.0 | Icon library |
| **Motion** | 13.1.1 | Animation library |
| **PostCSS** | 8.5.26 | CSS processing |
| **Autoprefixer** | 10.5.4 | CSS vendor prefixing |

### Database & Infrastructure
| Technology | Purpose |
|---|---|
| **Neon PostgreSQL** | Serverless cloud PostgreSQL hosting |
| **pgvector extension** | Vector storage and cosine similarity search |
| **PostgreSQL FTS** | Full-text search with `tsvector` and `tsquery` |

### AI / ML Models
| Model | Provider | Purpose | Dimension |
|---|---|---|---|
| **BAAI/bge-base-en-v1.5** | HuggingFace (local) | Text embeddings | 768 |
| **gemini-3.6-flash** | Google (REST API) | LLM answer generation | — |
| **NVIDIA RTX 3050** | Local GPU | CUDA acceleration for embeddings | — |

### External APIs
| API | Purpose |
|---|---|
| **Firecrawl API** | Web crawling and content extraction |
| **Google Gemini API** | LLM text generation |

---

## 4. Project File Structure

```
RAG/
├── .env                          # Environment variables (API keys, DB URL)
├── .env.example                  # Template for environment setup
├── .gitignore
├── README.md
├── pip.md                        # 22-phase implementation plan
├── prd.md                        # Product Requirements Document
│
├── backend/
│   ├── requirements.txt          # Python dependencies
│   └── app/
│       ├── __init__.py
│       ├── config.py             # Pydantic Settings (env loading)
│       ├── main.py               # FastAPI app + all routes + ingestion pipeline
│       ├── api/
│       │   └── __init__.py
│       ├── db/
│       │   ├── __init__.py
│       │   ├── models.py         # SQLAlchemy ORM models (6 tables)
│       │   └── session.py        # Async engine + session factory
│       └── services/
│           ├── __init__.py
│           ├── crawler.py        # Firecrawl web crawling service
│           ├── cleaner.py        # Content noise stripping
│           ├── chunker.py        # Structure-aware markdown chunking
│           ├── embedding.py      # BGE/Gemini/OpenAI embedding service
│           ├── retrieval.py      # Hybrid retrieval (semantic + lexical + RRF)
│           └── llm.py            # Gemini/OpenAI grounded answer generation
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # All pages and components (single-file SPA)
│       ├── index.css             # Global styles + Tailwind + custom DS theme
│       └── assets/
│
├── scripts/                      # Utility and debug scripts
│   ├── init_db.py                # Database initialization
│   ├── reembed_chunks_bge.py     # Re-embed chunks with BGE
│   ├── benchmark_bge.py          # BGE performance benchmarks
│   ├── test_bge_retrieval_quality.py
│   ├── test_gemini_36.py
│   └── ... (more diagnostic scripts)
│
└── tests/                        # Pytest test suites
    ├── test_crud.py
    ├── test_chunker.py
    ├── test_embedding.py
    ├── test_retrieval.py
    ├── test_llm.py
    └── ...
```

---

## 5. Backend Deep Dive

### 5.1 Configuration (`config.py`)
- Uses **Pydantic Settings** to load environment variables from `.env`
- Validates `DATABASE_URL` must start with `postgresql://`
- Parses `CORS_ORIGINS` from comma-separated string
- Key settings: `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `LLM_PROVIDER`, `LLM_MODEL`

### 5.2 Database Session (`session.py`)
- Auto-converts `postgresql://` → `postgresql+asyncpg://` for async compatibility
- Parses SSL parameters from the Neon connection string and passes them to `connect_args`
- Uses connection pooling (`pool_size=5`, `max_overflow=10`) with `pool_pre_ping=True`
- Special `NullPool` mode for pytest to avoid event loop conflicts
- `get_db()` dependency yields sessions with auto-commit and rollback

### 5.3 Crawler Service (`crawler.py`)
- Wraps the **Firecrawl Python SDK**
- `start_crawl_job()`: Initiates async crawl with `maxDepth=2`, `limit=20 pages`, markdown format
- `poll_and_process_crawl()`: Polls every 5 seconds (max 60 attempts = 5min timeout), logs progress to DB
- `save_pages_to_sources()`: Deduplicates using **SHA-256 content hashes**, classifies pages by URL path
- `determine_source_type()`: Auto-classifies pages as about/careers/product/blog/locations/general

### 5.4 Content Cleaner (`cleaner.py`)
Applies 7 regex-based cleaning rules in a single pass:
1. Cookie & privacy popup text removal
2. Copyright & legal boilerplate stripping
3. Social media link removal
4. Markdown image syntax removal (not useful for embeddings)
5. Empty heading cleanup
6. Navigation bar detection (inline link chains before first heading)
7. Skip-to-main-content anchor removal
- Post-processing: Collapses 3+ empty lines into 1

### 5.5 Structure-Aware Chunker (`chunker.py`)
- `_parse_sections()`: Walks markdown line-by-line, tracks H1→H6 heading hierarchy, groups content under their nearest heading path (e.g., "About Us > Our Team > Leadership")
- `_split_text_recursive()`: If a section exceeds 800 chars, recursively splits by: paragraphs → sentences → characters (fallback), with 150-char overlap
- Each chunk carries `section_header` metadata for citation context

### 5.6 Embedding Service (`embedding.py`)
- Supports 3 providers: **BGE (local)**, Gemini, OpenAI
- BGE mode: Uses `sentence-transformers` library with CUDA GPU acceleration
  - Model loaded as singleton (`_bge_model` class variable) to avoid reloading
  - Runs `encode()` in `asyncio.to_thread()` to avoid blocking the event loop
  - Normalizes embeddings, batch size 32
- Validates dimension is exactly 768 before storing
- Batch processing: 50 chunks per batch with periodic DB commits

### 5.7 Retrieval Service (`retrieval.py`)
Implements **Hybrid Retrieval** with three search strategies:

**Semantic Search** (`retrieve_semantic`):
- Generates query embedding via BGE
- Queries pgvector: `ORDER BY embedding <=> query_vector` (cosine distance)
- Returns top 20 candidates

**Lexical Search** (`retrieve_lexical`):
- Uses PostgreSQL full-text search: `to_tsvector('english', content) @@ websearch_to_tsquery('english', query)`
- Returns top 20 candidates

**Hybrid Fusion** (`retrieve_hybrid`):
- Combines both result sets using **Reciprocal Rank Fusion (RRF)**
- Formula: `RRF_score(d) = Σ 1/(k + rank_i(d))` where `k=60`
- Chunks appearing in both sets get boosted (marked as "hybrid")
- Returns top 5 with full source metadata (URL, title, type, section header)

### 5.8 LLM Service (`llm.py`)
- Calls **Gemini 3.6 Flash** via REST API (`generateContent` endpoint)
- Two-mode system prompt:
  - **Factual mode**: Direct answers grounded strictly in context with `[1][2]` citations
  - **Inferential mode**: Uses context as background for career/advisory questions
  - **Speculation guard**: Refuses future predictions or data not in context
- `_post_with_retry()`: Exponential backoff (2s→4s→8s→16s→30s→30s→30s), max 7 retries
- `_parse_used_citations()`: Regex extracts `[1]`, `[Source #1]` patterns, maps to source metadata including snippet and RRF score

---

## 6. Frontend Deep Dive

### 6.1 Design Theme
- **"DeepScout"** — Warm editorial aesthetic with gold (#F4C542) + sage green (#7C8460) accents
- Typography: Fraunces (editorial headings) + Manrope (body) + JetBrains Mono (code)
- Custom design system: `.ds-card`, `.ds-badge`, `.ds-input`, `.ds-msg-user`, `.ds-msg-ai`

### 6.2 Pages (React Router)
| Route | Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Hero section, pipeline visualization, feature cards, recent research |
| `/research` | `ResearchPage` | Company input form → triggers ingestion → live pipeline progress tracker |
| `/research/:companyId` | `CompanyWorkspacePage` | Chat-based Q&A workspace with citation evidence drawer |
| `/companies` | `DirectoryPage` | Company grid with search filter and delete functionality |
| `/sources` | `SourcesPage` | Evidence archive browser |
| `/history` | `HistoryPage` | Past research question history |

### 6.3 Key UI Features
- **Pipeline Progress Tracker**: 6-stage visual indicator (Discover → Clean → Chunk → Embed → Retrieve → Answer) with live polling
- **Chat Interface**: User/AI message bubbles with real-time query → grounded answer flow
- **Evidence Drawer**: Slide-in panel showing citation details (title, section, snippet, relevance score, source link, "Grounded Vector Match" badge)
- **Quick Prompts**: Pre-built research questions per company
- **Company Delete**: Red ✕ button with confirmation dialog and cascade delete

---

## 7. Database Schema

6 tables in Neon PostgreSQL:

```
┌─────────────────┐
│   companies      │  ← Root entity
│   ─────────────  │
│   id (UUID, PK)  │
│   name           │
│   website_url    │──────────────────┐
│   created_at     │                  │
│   updated_at     │                  │
└─────────────────┘                  │
        │ 1:N                        │
        ▼                            │
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│   sources        │  │  ingestion_jobs   │  │  research_questions  │
│   ─────────────  │  │  ──────────────   │  │  ────────────────    │
│   id (UUID, PK)  │  │  id (UUID, PK)    │  │  id (UUID, PK)      │
│   company_id(FK) │  │  company_id (FK)  │  │  company_id (FK)    │
│   url            │  │  status           │  │  question (Text)    │
│   title          │  │  pages_discovered │  │  answer (Text)      │
│   source_type    │  │  pages_processed  │  │  citations (JSON)   │
│   raw_content    │  │  error_message    │  │  created_at         │
│   content_hash   │  │  logs (Text)      │  └─────────────────────┘
└────────┬────────┘  └──────────────────┘
         │ 1:N
         ▼
┌─────────────────┐
│   documents      │
│   ─────────────  │
│   id (UUID, PK)  │
│   company_id(FK) │
│   source_id (FK) │
│   title          │
│   cleaned_content│
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────────────┐
│   chunks                 │  ← Core RAG table
│   ──────────────────     │
│   id (UUID, PK)          │
│   company_id (FK)        │
│   source_id (FK)         │
│   document_id (FK)       │
│   chunk_index (Integer)  │
│   section_header         │
│   content (Text)         │
│   embedding Vector(768)  │  ← pgvector column
│   created_at             │
└─────────────────────────┘
```

---

## 8. RAG Pipeline — Step by Step

Here is exactly what happens when you research a company:

### Step 1: User Submits Research Request
- Frontend POSTs to `/api/research` with `company_name` and `company_url`
- Backend creates a `Company` record and an `IngestionJob` record
- Returns immediately with `job_id` (HTTP 202 Accepted)
- Spawns a **BackgroundTask** for the heavy pipeline

### Step 2: Firecrawl Web Crawling
- Firecrawl SDK initiates an async crawl: `maxDepth=2`, `limit=20`, `formats=["markdown"]`
- `onlyMainContent: False` — extracts FULL page content (not just main section)
- Polls every 5 seconds until complete (max 5 minute timeout)
- Returns raw markdown for each discovered page

### Step 3: Duplicate Detection
- SHA-256 hash of each page's markdown content
- If hash already exists for this company → skip (prevents re-indexing identical pages)

### Step 4: Content Cleaning
- Single-pass regex pipeline removes:
  - Cookie consent banners and privacy popup text
  - Copyright notices and legal boilerplate
  - Social media profile links
  - Markdown image syntax
  - Empty headers
  - Top-of-page navigation bars
  - "Skip to main content" anchors

### Step 5: Structure-Aware Chunking
- Parses heading hierarchy: tracks H1 → H2 → H3 → H4 → H5 → H6
- Groups content under nearest heading context (e.g., "About Us > Business Divisions")
- Splits oversized sections: paragraphs → sentences → characters
- **800 characters max** per chunk, **150 character overlap**
- Each chunk retains its `section_header` for citation context

### Step 6: BGE Embedding
- Model: `BAAI/bge-base-en-v1.5` (loaded once as singleton)
- Device: NVIDIA RTX 3050 via CUDA (falls back to CPU)
- Produces 768-dimensional normalized float vectors
- Processes 50 chunks per batch with `asyncio.to_thread()` to avoid blocking

### Step 7: Vector Storage
- Embeddings stored in the `chunks.embedding` column (`Vector(768)`)
- pgvector extension enables cosine distance queries

### Step 8: User Asks a Question
- Frontend POSTs to `/api/query` with `company_id` and `question`

### Step 9: Hybrid Retrieval
1. **Semantic search**: Embed query → pgvector cosine distance → top 20
2. **Lexical search**: PostgreSQL FTS with `websearch_to_tsquery` → top 20
3. **RRF fusion**: Merge both sets, score each chunk: `RRF = Σ 1/(60 + rank)`
4. Return **top 5** chunks with full source metadata

### Step 10: Grounded LLM Generation
- Format 5 chunks into numbered `[Source #1]...[Source #5]` context blocks
- System prompt instructs Gemini to:
  - Answer factual questions using ONLY context evidence
  - Answer inferential questions using context as background
  - Cite sources with `[1]`, `[2]` markers
  - Refuse speculative/future prediction questions
- Parse citation markers from the answer → map to source URLs, titles, snippets, RRF scores

---

## 9. Environment Variables & Configuration

Create a `.env` file in the project root:

```env
# Database (Neon PostgreSQL with pgvector)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Firecrawl API Key
FIRECRAWL_API_KEY=fc-your-key-here

# Google Gemini API Key
GEMINI_API_KEY=AIzaSy-your-key-here

# Provider Configuration (current setup)
EMBEDDING_PROVIDER=bge
EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
LLM_PROVIDER=gemini
LLM_MODEL=models/gemini-3.6-flash
RERANKER_PROVIDER=none

# Optional (if using OpenAI or Cohere)
OPENAI_API_KEY=sk-your-key-here
COHERE_API_KEY=your-key-here

# Server
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 10. How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- NVIDIA GPU with CUDA (optional, falls back to CPU)
- Neon PostgreSQL account with pgvector extension enabled

### Backend Setup
```bash
cd RAG

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r backend/requirements.txt
pip install sentence-transformers torch

# Initialize database tables
python scripts/init_db.py

# Start backend server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd RAG/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Access
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## 11. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/config-check` | Show loaded provider configuration |
| `POST` | `/api/research` | Start company research (returns job_id) |
| `GET` | `/api/jobs/{job_id}` | Poll ingestion job status and logs |
| `POST` | `/api/query` | Ask a question about a company |
| `GET` | `/api/companies` | List all researched companies |
| `DELETE` | `/api/companies/{id}` | Delete a company and all its data |
| `GET` | `/api/companies/{id}/history` | Get Q&A history for a company |

---

## 12. Problems Faced & How They Were Solved

### Problem 1: Firecrawl Returns Empty Content on JS-Heavy Sites
**Symptom**: After crawling titancompany.in (Drupal CMS), all 38 chunks contained only `[Skip to main content](https://www.titancompany.in/#main-content)` — 65 bytes total.  
**Root Cause**: Firecrawl's default `onlyMainContent: True` relies on identifying a `<main>` element. On sites using accessibility skip-links with `#main-content` anchors, Firecrawl grabs only the anchor text instead of the page body.  
**Fix**: Changed `scrapeOptions` to `"onlyMainContent": False` in `crawler.py` — extracts the FULL page content.  
**Impact**: Re-crawl produced **912 rich chunks** instead of 38 empty ones.

---

### Problem 2: "I cannot find sufficient information" for Every Question
**Symptom**: Even basic questions like "What products does Titan offer?" got the refusal response.  
**Root Cause**: This was a direct consequence of Problem 1 — all stored chunks were empty skip-link text. The retrieval returned empty evidence, and Gemini correctly refused.  
**Fix**: Same fix as Problem 1. After re-ingestion with full content, all queries returned grounded answers.

---

### Problem 3: Gemini API 429 Rate Limiting
**Symptom**: The LLM call failed with `RuntimeError: LLM API call failed after 5 attempts` — all 5 retries hit 429.  
**Root Cause**: Free-tier Gemini API has strict RPM (requests per minute) quotas. The original retry had only 5 attempts with 1s initial backoff — not enough for sustained rate limiting.  
**Fix**: Upgraded to 7 retries with exponential backoff capped at 30s: `2s → 4s → 8s → 16s → 30s → 30s → 30s` (~2 minutes total wait). Also added 4s pause between sequential test queries.

---

### Problem 4: Gemini Model Deprecation (2.5-flash → 3.6-flash)
**Symptom**: API returned `404 NOT_FOUND: models/gemini-2.5-flash is no longer available to new users`.  
**Root Cause**: Google deprecated `gemini-2.5-flash` and recommended `gemini-3.6-flash`.  
**Fix**: Updated `LLM_MODEL` in config to `models/gemini-3.6-flash`.

---

### Problem 5: LLM Too Strict — Refuses General/Advisory Questions
**Symptom**: Questions like "What should I learn to join this company?" got refused even though context contained information about the company's tech stack and business divisions.  
**Root Cause**: The system prompt said "Answer using ONLY the retrieved source context blocks" and "Do NOT answer from your pre-trained general knowledge."  
**Fix**: Redesigned the prompt with two modes:
- **Factual mode**: Grounded answers with citations (for direct questions)
- **Inferential mode**: Uses context as background for advisory questions (e.g., career advice based on company's tech stack)
- **Speculation guard**: Still refuses future predictions

---

### Problem 6: Evidence Drawer Shows Blank Metadata
**Symptom**: The frontend Evidence Drawer displayed empty snippet and score fields.  
**Root Cause**: `_parse_used_citations()` in `llm.py` only returned `url`, `title`, `source_type`, and `section_header` — it omitted `snippet` and `relevance_score`.  
**Fix**: Added `snippet` (first 300 chars of chunk content) and `relevance_score` (rounded RRF score) to the citation dict.

---

### Problem 7: UnicodeEncodeError on Windows Console
**Symptom**: `print()` statements containing ₹ (rupee symbol) or other Unicode characters crashed with `UnicodeEncodeError: 'charmap' codec can't encode character`.  
**Root Cause**: Windows default console encoding is `cp1252`, which can't handle Unicode.  
**Fix**: Added `sys.stdout.reconfigure(encoding='utf-8')` at the top of test scripts.

---

### Problem 8: asyncpg SSL Connection Issues with Neon
**Symptom**: Database connection failed because asyncpg doesn't accept `sslmode=require` as a URL query parameter the way psycopg2 does.  
**Root Cause**: asyncpg expects SSL config via `connect_args`, not URL parameters.  
**Fix**: In `session.py`, parse the URL, extract `sslmode`, strip query params, and pass `{"ssl": True}` via `connect_args`.

---

### Problem 9: pytest Event Loop Conflicts
**Symptom**: Tests failed with connection pool errors related to event loop closure.  
**Root Cause**: SQLAlchemy connection pools hold references to the asyncio event loop, causing conflicts when pytest creates/destroys loops per test.  
**Fix**: Auto-detect pytest (`if "pytest" in sys.modules`) and use `NullPool` instead of connection pooling during tests.

---

### Problem 10: Duplicate Page Ingestion
**Symptom**: Re-crawling a company created duplicate chunks, bloating the database.  
**Root Cause**: No deduplication mechanism.  
**Fix**: Implemented SHA-256 content hashing — each page's markdown is hashed, and if the hash already exists for that company, the page is skipped.

---

## 13. Development Timeline (Git History)

| # | Commit | Description |
|---|---|---|
| 1 | `a25b587` | Phase 5: Structure-aware chunking |
| 2 | `a42e875` | Phase 6: BGE local embedding with CUDA, re-embedded 513 chunks, 13/13 tests |
| 3 | `d070f07` | Phases 7-10: Hybrid RRF retrieval, Gemini Q&A, citations, FastAPI endpoints, React UI, 16/16 tests |
| 4 | `c89a7bd` | UI Redesign V1: Dark intelligence dashboard |
| 5 | `f6a7413` | UI Redesign V2: Linear/Perplexity-grade dark aesthetics |
| 6 | `135ba72` | UI Redesign V3: Light corporate theme |
| 7 | `f6df7ef` | UI Redesign V4: Anime × Technology theme |
| 8 | `328b0f2` | UI Redesign V5 (Final): DeepScout warm editorial aesthetic |
| 9 | `69210b6` | **Core RAG fix**: Firecrawl `onlyMainContent=False`, cleaner skip-link filter, LLM retry upgrade |
| 10 | `10cd420` | Company delete button + relaxed LLM prompt for inferential answers |

---

## 14. Key Design Decisions

### Why Local BGE Instead of Cloud Embeddings?
- **Privacy**: Company data stays on your machine — no text sent to external embedding APIs
- **Cost**: Zero per-embedding cost (vs OpenAI at ~$0.0001/1K tokens)
- **Speed**: Local CUDA inference is faster than API round-trips for batch operations
- **Offline**: Works without internet for embedding generation

### Why Hybrid Retrieval (Not Just Semantic)?
- Semantic search misses exact keyword matches (e.g., product names, acronyms)
- Lexical FTS catches exact term matches that embedding similarity might miss
- RRF fusion gives the best of both worlds — chunks appearing in both sets get boosted

### Why RRF Over Other Fusion Methods?
- **Simple**: No tuning required (just `k=60`)
- **Robust**: Works well across different query types
- **Rank-based**: Doesn't require score normalization between different retrieval methods

### Why Single-File Frontend (App.tsx)?
- Rapid iteration during 5 UI redesign cycles
- All components share types/interfaces without import complexity
- Easy to read and understand the entire UI flow in one file

### Why Structure-Aware Chunking?
- Naive character splitting breaks sentences mid-thought
- Heading-aware splitting preserves section context (e.g., "About Us > Our Team")
- `section_header` metadata in each chunk helps Gemini cite specific sections

---

## 15. What I Learned

### Technical Skills
1. **RAG Pipeline Architecture** — End-to-end: crawl → clean → chunk → embed → store → retrieve → generate
2. **Vector Databases** — pgvector, cosine similarity, vector indexing
3. **Hybrid Search** — Combining semantic and lexical retrieval with Reciprocal Rank Fusion
4. **Local LLM/Embedding Deployment** — Running HuggingFace models on GPU with CUDA
5. **Async Python** — FastAPI, asyncpg, SQLAlchemy async, background tasks
6. **Prompt Engineering** — Grounding prompts, citation rules, multi-mode system instructions
7. **Web Scraping at Scale** — Firecrawl API, content deduplication, CMS compatibility issues
8. **Full-Stack Development** — React + TypeScript + Tailwind + FastAPI + PostgreSQL

### Soft Skills
- Debugging production issues systematically (empty chunks → trace back to crawler config)
- Handling API rate limits gracefully with retry logic
- Iterating on UI design (5 complete redesigns to reach the final aesthetic)
- Building under time pressure (placement deadline)

---

> **DeepScout** — *Research any company. Understand the evidence.*
