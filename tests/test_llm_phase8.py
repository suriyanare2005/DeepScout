import asyncio
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from backend.app.config import settings
from backend.app.services.llm import LLMService

@pytest.mark.asyncio
async def test_phase8_llm_grounded_generation_suite():
    print("\n--- Running Phase 8 LLM Service Test Suite ---")
    service = LLMService()
    
    # 1. Context Formatting Test
    contexts = [
        {
            "company_id": "c1",
            "company_name": "Acme Inc",
            "source_id": "s1",
            "source_url": "https://acme.example.com/about",
            "source_title": "About Acme",
            "source_type": "about",
            "section_header": "## History",
            "content": "Acme Inc was founded in 2010 in San Francisco."
        },
        {
            "company_id": "c1",
            "company_name": "Acme Inc",
            "source_id": "s2",
            "source_url": "https://acme.example.com/products",
            "source_title": "Acme Products",
            "source_type": "product",
            "section_header": "## Cloud Platform",
            "content": "Acme Cloud Platform is a high-availability serverless database."
        }
    ]
    
    formatted = service._format_contexts(contexts)
    assert "[Source #1]" in formatted
    assert "[Source #2]" in formatted
    assert "https://acme.example.com/about" in formatted
    assert "## History" in formatted
    print("   - PASS: 1. Context formatting & numbered context blocks")
    
    # 2. Citation Parsing Test (valid + duplicate + invalid out-of-bounds tags)
    raw_answer = (
        "Acme Inc was founded in 2010 [1]. "
        "They offer a cloud platform [2] which is serverless [Source #2]. "
        "Nonexistent citation [99] and malformed [invalid] tags should be handled safely."
    )
    parsed_citations = service._parse_used_citations(raw_answer, contexts)
    assert len(parsed_citations) == 2
    assert parsed_citations[0]["index"] == 1
    assert parsed_citations[0]["url"] == "https://acme.example.com/about"
    assert parsed_citations[1]["index"] == 2
    assert parsed_citations[1]["url"] == "https://acme.example.com/products"
    print("   - PASS: 2. Citation parsing with invalid tag safety")
    
    # 3. No Context Behavior Test
    empty_result = await service.generate_grounded_answer("What is the company revenue?", [])
    assert len(empty_result["citations"]) == 0
    assert "No relevant company information was retrieved" in empty_result["answer"] or "cannot answer" in empty_result["answer"]
    print("   - PASS: 3. Empty context refusal")
    
    # 4. Mock Provider Response & Retry Test
    mock_resp_fail = MagicMock()
    mock_resp_fail.status_code = 429
    mock_resp_fail.text = "Rate limit exceeded"
    
    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 200
    if service.provider == "gemini":
        mock_resp_success.json.return_value = {
            "candidates": [{
                "content": {"parts": [{"text": "Acme Inc was founded in 2010 [1]."}]}
            }]
        }
    else:
        mock_resp_success.json.return_value = {
            "choices": [{"message": {"content": "Acme Inc was founded in 2010 [1]."}}],
            "usage": {"total_tokens": 15}
        }
        
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [mock_resp_fail, mock_resp_success]
        with patch("backend.app.services.llm.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            res = await service.generate_grounded_answer("When was Acme founded?", contexts)
            assert "founded in 2010" in res["answer"]
            assert len(res["citations"]) == 1
            assert mock_post.call_count == 2
            mock_sleep.assert_called_once_with(1.0)
            print("   - PASS: 4. Bounded exponential backoff retry on 429 rate limit")
            
    # 5. Provider Configuration Check
    assert service.provider in ("gemini", "openai")
    print("   - PASS: 5. Provider configuration")
