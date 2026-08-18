import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

from backend.app.main import app
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, IngestionJob, Chunk, Source, Document, ResearchQuestion

@pytest.mark.asyncio
async def test_phase9_fastapi_endpoints_suite():
    print("\n--- Running Phase 9 FastAPI Endpoints Test Suite ---")
    
    async with AsyncSessionLocal() as session:
        # Create test company and records
        uid = uuid.uuid4().hex[:8]
        comp = Company(
            name=f"Phase9 Corp {uid}",
            website_url=f"https://phase9-{uid}.example.com"
        )
        session.add(comp)
        await session.flush()
        
        job = IngestionJob(
            company_id=comp.id,
            status="completed",
            pages_discovered=10,
            pages_processed=10,
            logs="Crawl completed."
        )
        session.add(job)
        await session.flush()
        
        src = Source(
            company_id=comp.id,
            url=f"{comp.website_url}/about",
            title="About Phase9",
            indexing_status="completed"
        )
        session.add(src)
        await session.flush()
        
        doc = Document(
            company_id=comp.id,
            source_id=src.id,
            title=src.title,
            cleaned_content="Phase9 Corp builds high-speed data pipelines."
        )
        session.add(doc)
        await session.flush()
        
        chunk = Chunk(
            company_id=comp.id,
            source_id=src.id,
            document_id=doc.id,
            chunk_index=0,
            section_header="## Overview",
            content="Phase9 Corp builds high-speed data pipelines using Python and Rust.",
            embedding=[0.01] * 768
        )
        session.add(chunk)
        await session.flush()
        await session.commit()
        
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                # 1. GET /api/companies
                res_comp = await ac.get("/api/companies")
                assert res_comp.status_code == 200
                comp_list = res_comp.json()
                assert any(c["id"] == str(comp.id) for c in comp_list)
                print("   - PASS: 1. GET /api/companies")
                
                # 2. GET /api/jobs/{id} (valid + 404)
                res_job = await ac.get(f"/api/jobs/{job.id}")
                assert res_job.status_code == 200
                assert res_job.json()["status"] == "completed"
                
                res_fake_job = await ac.get(f"/api/jobs/{uuid.uuid4()}")
                assert res_fake_job.status_code == 404
                print("   - PASS: 2. GET /api/jobs/{id} (valid & 404)")
                
                # 3. POST /api/research (valid input)
                with patch("fastapi.BackgroundTasks.add_task") as mock_task:
                    res_research = await ac.post("/api/research", json={
                        "company_name": f"New Co {uid}",
                        "company_url": f"https://newco-{uid}.com"
                    })
                    assert res_research.status_code == 202
                    assert "job_id" in res_research.json()
                    mock_task.assert_called_once()
                    print("   - PASS: 3. POST /api/research")
                    
                # 4. POST /api/query (valid company query)
                res_query = await ac.post("/api/query", json={
                    "company_id": str(comp.id),
                    "question": "What technologies does Phase9 Corp use?"
                })
                assert res_query.status_code == 200
                q_data = res_query.json()
                assert "answer" in q_data
                assert "citations" in q_data
                print("   - PASS: 4. POST /api/query (valid company)")
                
                # 5. POST /api/query (404 unknown company)
                res_fake_q = await ac.post("/api/query", json={
                    "company_id": str(uuid.uuid4()),
                    "question": "Hello?"
                })
                assert res_fake_q.status_code == 404
                print("   - PASS: 5. POST /api/query (404 unknown company)")
                
                # 6. GET /api/companies/{id}/history
                res_hist = await ac.get(f"/api/companies/{comp.id}/history")
                assert res_hist.status_code == 200
                hist_data = res_hist.json()
                assert len(hist_data) >= 1
                assert hist_data[0]["question"] == "What technologies does Phase9 Corp use?"
                print("   - PASS: 6. GET /api/companies/{id}/history")
                
        finally:
            # Cleanup test company
            comp_to_del = await session.get(Company, comp.id)
            if comp_to_del:
                await session.delete(comp_to_del)
                await session.commit()
            print("   - SUCCESS: Cleanup complete.")
