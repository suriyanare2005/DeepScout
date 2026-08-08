import os
import sys

# Adjust path to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from backend.app.config import settings
    print("1. Configuration loaded successfully.")
    print(f"   - Database URL loaded (length: {len(settings.DATABASE_URL) if settings.DATABASE_URL else 0})")
    print(f"   - Embedding Provider: {settings.EMBEDDING_PROVIDER}")
    print(f"   - LLM Provider: {settings.LLM_PROVIDER}")
    print(f"   - Firecrawl API key loaded: {settings.FIRECRAWL_API_KEY is not None}")
    print(f"   - OpenAI API key loaded: {settings.OPENAI_API_KEY is not None}")
    print(f"   - Gemini API key loaded: {settings.GEMINI_API_KEY is not None}")
    print(f"   - Cohere API key loaded: {settings.COHERE_API_KEY is not None}")
except Exception as e:
    print(f"Error loading configuration: {e}")
    sys.exit(1)

# Import psycopg2 after paths are configured
try:
    import psycopg2
except ImportError:
    print("Error: psycopg2 is not installed. Please run pip install -r backend/requirements.txt first.")
    sys.exit(1)

try:
    # Connect using psycopg2 (sync client for diagnostic check)
    print("2. Attempting to connect to Neon PostgreSQL...")
    conn = psycopg2.connect(settings.DATABASE_URL)
    print("   - Connection successful!")
    
    print("3. Checking for pgvector extension...")
    cursor = conn.cursor()
    cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
    result = cursor.fetchone()
    if result:
        print("   - SUCCESS: pgvector is available and installed!")
    else:
        print("   - WARNING: pgvector extension is NOT installed in the database. Attempting to install...")
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            conn.commit()
            print("   - SUCCESS: pgvector extension created successfully!")
        except Exception as vec_err:
            print(f"   - ERROR: Failed to install pgvector extension: {vec_err}")
            sys.exit(1)
            
    cursor.close()
    conn.close()
    print("All environment checks passed successfully!")
except Exception as e:
    print(f"Error connecting to database: {e}")
    sys.exit(1)
