"""
Diagnostic: inspect actual page dict structure returned by Firecrawl v1 SDK.
Run with: .venv\Scripts\python scripts/inspect_firecrawl_response.py
"""
import sys, json
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from firecrawl import FirecrawlApp

app = FirecrawlApp(api_key=settings.FIRECRAWL_API_KEY)

print("Starting single-page scrape of https://example.com for structure inspection...")
result = app.scrape_url("https://example.com", params={"formats": ["markdown"]})

print("\n=== scrape_url result type:", type(result))
print("=== scrape_url result keys:", list(result.keys()) if isinstance(result, dict) else "N/A")
print("=== Full result (truncated to 2000 chars):")
print(json.dumps(result, indent=2, default=str)[:2000])
