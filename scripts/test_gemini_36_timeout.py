import sys, httpx, asyncio

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings

async def test_36_timeout():
    model = "models/gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": "Say hello in one word."}]}]
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, timeout=30.0)
        print(f"Model: {model} -> Status: {res.status_code}")
        if res.status_code == 200:
            print("Output:", res.json()["candidates"][0]["content"]["parts"][0]["text"].strip())
        else:
            print("Error:", res.text[:200])

if __name__ == "__main__":
    asyncio.run(test_36_timeout())
