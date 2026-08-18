"""
Live test runner for TCS research pipeline
"""
import time
import requests

API_BASE = "http://localhost:8000"

def main():
    print("=" * 60)
    print("Live E2E Test: Researching Tata Consultancy Services (TCS)")
    print("=" * 60)
    
    # 1. Trigger research
    print("Sending POST /api/research for TCS...")
    start_time = time.time()
    res = requests.post(f"{API_BASE}/api/research", json={
        "company_name": "Tata Consultancy Services",
        "company_url": "https://www.tcs.com/"
    })
    
    if res.status_code != 202:
        print(f"Error triggering research: {res.status_code} {res.text}")
        return
        
    data = res.json()
    company_id = data["company_id"]
    job_id = data["job_id"]
    print(f"Job triggered successfully! Company ID: {company_id}, Job ID: {job_id}")
    
    # 2. Poll job status
    print("\nPolling job progress...")
    last_log_len = 0
    while True:
        job_res = requests.get(f"{API_BASE}/api/jobs/{job_id}")
        if job_res.status_code != 200:
            print(f"Error fetching job status: {job_res.status_code}")
            time.sleep(3)
            continue
            
        job_data = job_res.json()
        status = job_data["status"]
        discovered = job_data["pages_discovered"]
        processed = job_data["pages_processed"]
        logs = job_data.get("logs") or ""
        
        # Print new log lines
        if len(logs) > last_log_len:
            new_logs = logs[last_log_len:]
            print(new_logs, end="")
            last_log_len = len(logs)
            
        if status == "completed":
            elapsed = time.time() - start_time
            print(f"\n✅ Ingestion completed in {elapsed:.2f} seconds!")
            print(f"Total Pages Discovered: {discovered}, Processed: {processed}")
            break
        elif status == "failed":
            print(f"\n❌ Ingestion failed! Error: {job_data.get('error_message')}")
            return
            
        time.sleep(3)
        
    # 3. Test Question Answering
    print("\n" + "=" * 60)
    print("Testing Grounded Q&A Query for TCS...")
    print("=" * 60)
    
    q_start = time.time()
    query_res = requests.post(f"{API_BASE}/api/query", json={
        "company_id": company_id,
        "question": "What core IT services, digital solutions, and cloud products does TCS offer?"
    })
    
    q_elapsed = time.time() - q_start
    if query_res.status_code != 200:
        print(f"Query error: {query_res.status_code} {query_res.text}")
        return
        
    q_data = query_res.json()
    print(f"Query completed in {q_elapsed:.2f} seconds.\n")
    print("--- Grounded Answer ---")
    print(q_data["answer"])
    print("\n--- Citations ---")
    for cit in q_data.get("citations", []):
        print(f"[{cit['index']}] {cit['title']} | {cit['section_header']} | {cit['url']}")

if __name__ == "__main__":
    main()
