import sys, httpx, asyncio

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings

async def test_36():
    models_to_test = ["models/gemini-3.6-flash", "models/gemini-2.5-flash", "gemini-2.5-flash"]
    async with httpx.AsyncClient() as client:
        for model in models_to_test:
            url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": "Say hello in one word."}]}]
            }
            res = await client.post(url, json=payload, timeout=10.0)
            print(f"Model: {model} -> Status: {res.status_code}")
            if res.status_code == 200:
                print("   Output:", res.json()["candidates"][0]["content"]["parts"][0]["text"].strip())
            else:
                print("   Error:", res.text[:200])

if __name__ == "__main__":
    asyncio.run(test_36())
