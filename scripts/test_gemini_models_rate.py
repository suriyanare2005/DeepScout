"""
Test Gemini LLM models for 429 rate limit
"""
import sys, httpx, asyncio

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings

async def test_llm_models():
    models_to_test = ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-1.5-flash-8b"]
    
    async with httpx.AsyncClient() as client:
        for model in models_to_test:
            url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": "Say hello in one word."}]}]
            }
            try:
                res = await client.post(url, json=payload, timeout=10.0)
                print(f"Model: {model} -> Status: {res.status_code}")
                if res.status_code == 200:
                    print("   Output:", res.json()["candidates"][0]["content"]["parts"][0]["text"].strip())
                else:
                    print("   Error:", res.text[:200])
            except Exception as e:
                print(f"Model: {model} -> Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm_models())
