import requests

API_BASE = "http://localhost:8000"
COMPANY_ID = "a63d171e-2544-496a-90b7-42a17f63be03"

def main():
    print("Testing Instant Query on TCS (Tata Consultancy Services)...")
    res = requests.post(f"{API_BASE}/api/query", json={
        "company_id": COMPANY_ID,
        "question": "What IT services, digital solutions, and cloud transformation products does TCS offer?"
    })
    
    if res.status_code == 200:
        data = res.json()
        print("\n--- GROUNDED ANSWER ---")
        print(data["answer"])
        print("\n--- CITATIONS ---")
        for c in data.get("citations", []):
            print(f"[{c['index']}] {c['title']} | {c['section_header']} | {c['url']}")
    else:
        print(f"Error: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
