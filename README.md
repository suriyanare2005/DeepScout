# Company Research RAG

An automated web intelligence crawling and question-answering tool that researches any company using only its root URL, indexes its pages using pgvector, and exposes grounded Q&A with verifiable source citations.

---

## Architecture Layout

```
/rag-workspace
├── backend/            # Python FastAPI app
│   ├── app/
│   │   ├── api/        # FastAPI endpoints
│   │   ├── db/         # PostgreSQL + pgvector schemas & connections
│   │   ├── services/   # RAG pipeline modules (crawl, clean, chunk, etc.)
│   │   └── config.py   # Settings verification logic
│   └── requirements.txt
├── frontend/           # React TS SPA + Tailwind CSS
├── scripts/            # Database initialization and chunking debug tools
├── tests/              # Pytest verification suites
└── README.md
```

---

## Data Flow Pipeline

```
[Target Homepage URL]
   │
   ▼
[Web Crawler: Firecrawl] -> Fetches relevant subpages (About, Careers, Products)
   │
   ▼
[Content Cleaner]        -> Strips CSS, boilerplate navbars, scripts, cookies
   │
   ▼
[Structure-Aware Chunk]  -> Segments clean texts retaining section hierarchy
   │
   ▼
[Embedding Generator]    -> Computes floats representations
   │
   ▼
[pgvector Database]      -> Stores text + embedding index + metadata mappings
   │
   ├───────────────────────────────┐
   ▼ (Conversational Q&A Search)   ▼ (Lexical Search)
[Semantic Vector Match]         [PostgreSQL Full-Text Search]
   │                               │
   └──────────────┬────────────────┘
                  ▼
       [RRF Hybrid Score Fusion]
                  │
                  ▼
       [Cross-Encoder Reranker]  -> Reranks candidate contexts to top 5
                  │
                  ▼
         [Grounding Prompt]      -> Integrates context + instructions
                  │
                  ▼
            [LLM Engine]         -> Generates grounded response
                  │
                  ▼
         [Attribution Binder]    -> Maps citations deterministically
                  │
                  ▼
       [Research UI Dashboard]
```

---

## Local Setup

### 1. Database
Ensure a PostgreSQL database (e.g. Neon or local instance) is active and the `pgvector` extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Config
1. Create a `.env` file in the root workspace copying `.env.example` configurations.
2. Setup a Python virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # On Windows
   source .venv/bin/activate # On Unix
   ```
3. Install requirements:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Start dev server:
   ```bash
   python -m backend.app.main
   ```
