import asyncio
import os
import sys
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import httpx

# Adjust path to import backend app
sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.config import settings
from backend.app.services.llm import LLMService

@pytest.mark.asyncio
async def test_live_llm_grounding_and_citations():
    print("\n--- Running Live LLM Grounding & Citations Test ---")
    service = LLMService()
    
    # 1. Provide mock retrieval context
    contexts = [
        {
            "source_url": "https://acme.example.com/about",
            "source_title": "About Acme Corp",
            "source_type": "about",
            "section_header": "## History",
            "content": "Acme Corp was founded in 1985 by Jane Doe to manufacture high-efficiency widgets."
        },
        {
            "source_url": "https://acme.example.com/products",
            "source_title": "Products | Acme",
            "source_type": "product",
            "section_header": "## Acme Widget Pro",
            "content": "The Acme Widget Pro is our flagship product, featuring low-latency processing speeds."
        }
    ]
    
    # 2. Ask a factual question present in the contexts
    question = "Who founded Acme Corp and what is their flagship product?"
    
    result = await service.generate_grounded_answer(question, contexts)
    print(f"LLM Answer:\n{result['answer']}")
    print(f"Extracted Citations: {result['citations']}")
    
    # Assertions
    assert len(result["answer"]) > 0
    assert "Jane Doe" in result["answer"] or "1985" in result["answer"]
    assert "Widget Pro" in result["answer"]
    
    # Verify citations are successfully mapped
    assert len(result["citations"]) > 0
    # Should trace back to at least one of the URLs
    citation_urls = [c["url"] for c in result["citations"]]
    assert any(url in citation_urls for url in ["https://acme.example.com/about", "https://acme.example.com/products"])
    print("   - SUCCESS: Live grounded generation matches context and maps citations correctly.")

@pytest.mark.asyncio
async def test_llm_negative_hallucination_prevention():
    print("\n--- Running LLM Negative Hallucination Protection Test ---")
    service = LLMService()
    
    # Context with irrelevant information
    contexts = [
        {
            "source_url": "https://acme.example.com/about",
            "source_title": "About Acme Corp",
            "source_type": "about",
            "section_header": "## Overview",
            "content": "We manufacture widgets."
        }
    ]
    
    # Question NOT answerable from contexts
    question = "What was the company's total revenue in the fiscal year 2025?"
    
    result = await service.generate_grounded_answer(question, contexts)
    print(f"Negative Question Answer: '{result['answer']}'")
    
    # The system prompt should force it to deny answering
    assert "cannot find sufficient information" in result["answer"].lower() or "no relevant" in result["answer"].lower()
    print("   - SUCCESS: Correctly refused to hallucinate details not present in contexts.")

@pytest.mark.asyncio
async def test_llm_retry_behavior_on_error():
    print("\n--- Running LLM Retry Behavior Test ---")
    service = LLMService()
    
    # Mock transient 500 error followed by 200 success
    mock_resp_fail = MagicMock()
    mock_resp_fail.status_code = 500
    mock_resp_fail.text = "Internal Server Error"
    
    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 200
    
    # Mock response format
    if service.provider == "gemini":
        mock_resp_success.json.return_value = {
            "candidates": [{
                "content": {"parts": [{"text": "Hello [1]."}]}
            }]
        }
    else:
        mock_resp_success.json.return_value = {
            "choices": [{"message": {"content": "Hello [1]."}}],
            "usage": {"total_tokens": 10}
        }
        
    contexts = [{"source_url": "https://acme.example.com/test", "source_title": "Test Title"}]
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [mock_resp_fail, mock_resp_success]
        
        with patch("backend.app.services.llm.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            result = await service.generate_grounded_answer("Say hello", contexts)
            
            assert "Hello" in result["answer"]
            assert len(result["citations"]) == 1
            assert result["citations"][0]["url"] == "https://acme.example.com/test"
            assert mock_post.call_count == 2
            mock_sleep.assert_called_once_with(1.0)
            print("   - SUCCESS: Successfully retried and processed LLM query after 500 error.")
