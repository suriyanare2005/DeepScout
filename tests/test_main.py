import pytest
import uuid
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.main import app
from backend.app.db.session import AsyncSessionLocal
from backend.app.db.models import Company, IngestionJob, Chunk

@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_config_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/config-check")
        assert response.status_code == 200
        assert "embedding_provider" in response.json()
        assert "llm_provider" in response.json()

@pytest.mark.asyncio
async def test_research_trigger_endpoint():
    # We mock background tasks so it does not trigger the real ingestion pipeline
    with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
        async with AsyncSessionLocal() as session:
            # Generate a unique URL to avoid clashes
            unique_url = f"https://endpoint-test-{uuid.uuid4().hex[:8]}.example.com"
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.post("/api/research", json={
                    "company_name": "Endpoint Test LLC",
                    "company_url": unique_url
                })
                
                assert response.status_code == 202
                data = response.json()
                assert "company_id" in data
                assert "job_id" in data
                assert data["status"] == "pending"
                
                job_id = data["job_id"]
                company_id = data["company_id"]
                
                # Check status endpoint
                status_response = await ac.get(f"/api/jobs/{job_id}")
                assert status_response.status_code == 200
                assert status_response.json()["status"] == "pending"
                
                # Clean up the DB
                comp = await session.get(Company, uuid.UUID(company_id))
                if comp:
                    await session.delete(comp)
                    await session.commit()
                    
                mock_add_task.assert_called_once()
