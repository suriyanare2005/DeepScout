# Project Implementation Plan (PIP): Company Research RAG

This implementation plan outlines the development path for the **Company Research RAG** web application. It breaks down the build cycle into 22 distinct phases (Phase 0 to Phase 21), ensuring a modular, testable, and highly decoupled RAG pipeline.

---

## User Review Required

> [!IMPORTANT]
> To execute this plan, the developer and Antigravity must divide responsibilities. Please review the division of tasks in **Phase 0**.

### Target Stack & Versions
- **Frontend**: React (Vite-based) + TypeScript + Tailwind CSS
- **Backend**: Python 3.10+ + FastAPI
- **Database**: PostgreSQL (v14+) with the `pgvector` extension enabled
- **Web Ingestion**: Firecrawl API

---

## Open Questions

> [!IMPORTANT]
> Please review and provide your preferences on the following:
> 1. **Initial Test Company**: Which company website should be our target for validation (e.g., `https://stripe.com` or `https://vercel.com` make excellent testing ground truths)?
> 2. **Embedding and Generation Providers**: Do we start with OpenAI (`text-embedding-3-small` / `gpt-4o-mini`) or Google Gemini (`text-embedding-004` / `gemini-1.5-flash`) as the default providers?
> 3. **Database Hosting**: Will you run PostgreSQL via a local Docker container or use a hosted server (e.g., Supabase / Neon) for local development?

---

## Proposed Phased Changes

The codebase will be initialized using a clean monorepo structure:
- `/backend`: Python FastAPI app, DB clients, and RAG modules.
- `/frontend`: React + TypeScript SPA.
- `/scripts`: Local management and verification utilities.
- `/tests`: Pytest-based unit, integration, and RAG evaluation tests.

```
/rag-workspace
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI Routes (endpoints.py)
│   │   ├── db/           # Session management & SQLAlchemy schemas
│   │   ├── services/     # Decoupled RAG pipeline layers
│   │   └── config.py     # Environment variables schema (Pydantic)
│   └── requirements.txt
├── frontend/
│   ├── src/              # React components (Dashboard, Chat, Progress)
│   ├── package.json
│   └── tailwind.config.js
├── scripts/              # Local migration & chunk debug scripts
├── tests/                # Pipeline verification test suite
└── README.md
```

---

### PHASE 0 — HUMAN PREPARATION
Before coding begins, the developer must prepare the environment. Antigravity cannot access external accounts or generate local credentials.

| Action Item | Responsible Party | Verification Method |
| :--- | :--- | :--- |
| Create GitHub repository | **Developer** | `git remote -v` |
| Install Python (3.10+) & Node.js | **Developer** | `python --version` & `node --version` |
| Spin up PostgreSQL instance | **Developer** | Connect via pgAdmin/psql |
| Verify `pgvector` extension | **Developer** | Run `CREATE EXTENSION IF NOT EXISTS vector;` |
| Create accounts for Firecrawl & LLM | **Developer** | Verify logins on developer portals |
| Create `.env` file | **Developer** | Create locally, do not commit |
| Add template keys to `.env.example` | **Antigravity** | Verify file present in root |
| Configure `.gitignore` to block `.env` | **Antigravity** | Check `.gitignore` for `.env` entries |

---

### PHASE 1 — PROJECT INITIALIZATION
Setting up the project scaffolding, dependency configs, and environment schema validation.
* **[NEW]** [/backend/requirements.txt](file:///c:/Users/SURIYA/Desktop/RAG/backend/requirements.txt): Declarative backend dependencies (FastAPI, SQLAlchemy, psycopg2-binary, pydantic-settings, firecrawl-py, openai, cohere).
* **[NEW]** [/backend/app/config.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/config.py): Pydantic-based configuration validator.
* **[NEW]** [/backend/app/main.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/main.py): FastAPI server initialization with CORS policies.
* **[NEW]** [/.env.example](file:///c:/Users/SURIYA/Desktop/RAG/.env.example): Boilerplate key labels.
* **[NEW]** [/.gitignore](file:///c:/Users/SURIYA/Desktop/RAG/.gitignore): Ignore node modules, virtual environments, build outputs, and `.env`.

---

### PHASE 2 — DATABASE
Modeling schema objects and establishing connection classes with pgvector configurations.
* **[NEW]** [/backend/app/db/session.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/db/session.py): Async SQLAlchemy engine and session makers.
* **[NEW]** [/backend/app/db/models.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/db/models.py): SQLAlchemy models mapping:
  - `companies`: ID, name, website URL.
  - `sources`: ID, URL, title, source type, crawl status, timestamp, raw content.
  - `chunks`: ID, section context, text, embedding vector (`Vector(1536)`), tsvector.
  - `ingestion_jobs`: Trace job status, pages discovered, logs.
  - `research_questions`: Store historical user queries and responses.
* **[NEW]** [/scripts/init_db.py](file:///c:/Users/SURIYA/Desktop/RAG/scripts/init_db.py): Database initializer script to run migrations, create tables, and assign vector/lexical GIN indexes.

---

### PHASE 3 — WEB INGESTION
Integrating Firecrawl to scan root directories, scrape page payloads, and output markdown files.
* **[NEW]** [/backend/app/services/crawler.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/crawler.py): Firecrawl crawler service.
  - Handles domain boundary validation.
  - Discovers priority segments (`/about`, `/careers`, `/products`).
  - Implements exponential backoffs for `429` rate-limit errors.
  - Computes content hashes of raw payloads to skip duplicate page indexing.

---

### PHASE 4 — CONTENT CLEANING
Removing DOM clutter and keeping textual formatting.
* **[NEW]** [/backend/app/services/cleaning.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/cleaning.py):
  - Strip HTML script/style, navbars, footers, social media sharing snippets, cookie popups.
  - Clean consecutive whitespaces and double carriage returns.
  - Keep heading boundaries (`#`, `##`) intact.

---

### PHASE 5 — CHUNKING
Breaking down cleaned web scripts into structured, metadata-rich semantic items.
* **[NEW]** [/backend/app/services/chunking.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/chunking.py):
  - Heading-aware parser to split texts (target size: 500-1000 characters, overlap: 150).
  - Prepends parent hierarchy info (e.g., "[Section: Career Openings] ...").
* **[NEW]** [/scripts/debug_chunks.py](file:///c:/Users/SURIYA/Desktop/RAG/scripts/debug_chunks.py): Debug runner that prints chunk splits, sizes, overlaps, and inherited metadata tags for manual quality inspection.

---

### PHASE 6 — EMBEDDINGS
Establishing abstract providers to compute and register chunk vectors.
* **[NEW]** [/backend/app/services/embeddings.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/embeddings.py):
  - Interface class `BaseEmbeddingProvider`.
  - Concrete class `OpenAIEmbeddingProvider` / `GeminiEmbeddingProvider`.
  - Generates batch embeddings for page chunks and handles vector dimension matching.

---

### PHASE 7 — BASIC VECTOR RETRIEVAL
Implementing the semantic retrieval layer with pgvector operators.
* **[NEW]** [/backend/app/services/retrieval.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/retrieval.py):
  - Query vectorizer.
  - Cosine distance similarity query builder (selecting top $K$ database chunks).
  - Exposes metadata maps (similarity score, URL, section name, raw text).

---

### PHASE 8 — LLM GENERATION
Connecting generated prompts to chat services under strict grounding rules.
* **[NEW]** [/backend/app/services/generation.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/generation.py):
  - Interface class `BaseLLMProvider`.
  - Concrete class `OpenAILLMProvider` / `GeminiLLMProvider`.
  - System prompt enforcing strict context compliance (no extrapolation, standardized fallback on lack of evidence).

---

### PHASE 9 — CITATIONS
Extracting and formatting verifiable source references deterministic of context indexing.
* **[NEW]** [/backend/app/services/citations.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/citations.py):
  - Maps LLM footnote references (`[1]`, `[2]`) directly to the original metadata arrays returned in the retrieval phase.
  - Ensures source URL, page title, and section titles are mapped directly, preventing generated URL hallucination.

---

### PHASE 10 — INITIAL WEB APPLICATION
Creating UI interfaces to run crawling pipelines and query company resources.
* **[NEW]** [/frontend/src/components/Home.tsx](file:///c:/Users/SURIYA/Desktop/RAG/frontend/src/components/Home.tsx): Company onboarding search input (Name + URL).
* **[NEW]** [/frontend/src/components/ProgressTracker.tsx](file:///c:/Users/SURIYA/Desktop/RAG/frontend/src/components/ProgressTracker.tsx): Renders crawler logs and queue percentages.
* **[NEW]** [/frontend/src/components/Dashboard.tsx](file:///c:/Users/SURIYA/Desktop/RAG/frontend/src/components/Dashboard.tsx): Tab-based display cards (Overview, Products, Tech Stack, Careers, Locations).
* **[NEW]** [/frontend/src/components/Chat.tsx](file:///c:/Users/SURIYA/Desktop/RAG/frontend/src/components/Chat.tsx): Conversational QA panel with side-drawer citation lookups.

---

### PHASE 11 — HYBRID RETRIEVAL
Blending semantic and keyword searches for optimized query performance.
* **[MODIFY]** [/backend/app/services/retrieval.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/retrieval.py):
  - Builds lexical `tsvector` query matches.
  - Merges vector rankings and keyword rankings using **Reciprocal Rank Fusion (RRF)**.
  - Exposes debugging logs showing semantic scores, keyword weights, and fusion ranks.

---

### PHASE 12 — RERANKING
Applying cross-encoder networks to refine search quality.
* **[NEW]** [/backend/app/services/reranking.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/reranking.py):
  - Wrapper interface `BaseRerankerProvider`.
  - Concrete class `CohereReranker` / `SentenceTransformerReranker`.
  - Filters candidate contexts down to the most relevant top 5.

---

### PHASE 13 — CONTEXT CONSTRUCTION
Managing context size limits and parsing boundaries.
* **[MODIFY]** [/backend/app/services/retrieval.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/retrieval.py):
  - Token counting logic to prevent prompt overflows.
  - Context assembler that drops duplicate information, prefixes header details, and packs records within the model's optimal retrieval window.

---

### PHASE 14 — RAG EVALUATION
Designing metrics monitors to evaluate system quality.
* **[NEW]** [/backend/app/services/evaluation.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/services/evaluation.py):
  - Evaluator engine calculating Faithfulness, Answer Relevance, and Context Recall metrics.
  - Latency tracker detailing query phase execution costs (Retrieval, Reranking, Generation).
* **[NEW]** [/tests/test_evaluation_runner.py](file:///c:/Users/SURIYA/Desktop/RAG/tests/test_evaluation_runner.py): Script running comparisons across Vector-only, Hybrid-only, and Hybrid + Reranker pipelines.

---

### PHASE 15 — ERROR HANDLING
Catching processing exceptions to prevent crashes.
* **[MODIFY]** Custom exception middleware across endpoints:
  - Validates formatting using Pydantic schemas.
  - Intercepts API failures and renders explicit user-facing status messages (e.g., "Company crawler blocked by target robots.txt policy").

---

### PHASE 16 — TESTING
Assembling automated QA test suites.
* **[NEW]** [/tests/test_crawler.py](file:///c:/Users/SURIYA/Desktop/RAG/tests/test_crawler.py): Mocked crawler responses validating extraction bounds.
* **[NEW]** [/tests/test_pipeline.py](file:///c:/Users/SURIYA/Desktop/RAG/tests/test_pipeline.py): Integration tests tracking a text segment from ingestion down to vector matching in PostgreSQL.

---

### PHASE 17 — OBSERVABILITY
Monitoring background processes and latency values.
* **[NEW]** [/backend/app/logging_config.py](file:///c:/Users/SURIYA/Desktop/RAG/backend/app/logging_config.py): Structured JSON logger formatting runtime events, indexing speeds, and query performance telemetry (without logging environment secrets).

---

### PHASE 18 — SECURITY
Validating payloads and hardening api routers.
* **[MODIFY]** Endpoint security checks:
  - Backend validation of website scheme formats to prevent SSRF vulnerabilities.
  - Restricts CORS access to dev/production ports only.

---

### PHASE 19 — DOCUMENTATION
Packaging installation instructions and configurations details.
* **[NEW]** [/README.md](file:///c:/Users/SURIYA/Desktop/RAG/README.md): Document explaining running local dev servers, initiating PostgreSQL vector indices, configuring `.env` keys, and executing the evaluation run tests.

---

### PHASE 20 — DEPLOYMENT PREPARATION
Compiling application bundles and configuring server headers.
* **[NEW]** [/backend/Dockerfile](file:///c:/Users/SURIYA/Desktop/RAG/backend/Dockerfile): Container builds packing Python dependencies.
* **[NEW]** [/frontend/vite.config.ts](file:///c:/Users/SURIYA/Desktop/RAG/frontend/vite.config.ts): Build routing setup and environment injections for prod.

---

### PHASE 21 — FINAL VALIDATION
Performing end-to-end integration audits.
* Run a clean pipeline from root company crawler ingestion up to conversational query response citations. Verify all evaluation metrics output successfully.

---

## Verification Plan

### Automated Tests
To confirm functionality after each phase:
- Run backend database checks: `pytest tests/test_db.py`
- Run RAG pipeline checks: `pytest tests/test_pipeline.py`
- Run evaluation benchmarks: `python tests/test_evaluation_runner.py`

### Manual Verification
- Ingest a test company website (e.g., `https://stripe.com`) and verify logs in the terminal.
- Launch the React app, ask "What products do they offer?", click the citation indices, and inspect if the highlighted section mapping opens the correct page URL.
