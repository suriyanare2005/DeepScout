import logging
import re
import httpx
import asyncio
from backend.app.config import settings

logger = logging.getLogger("company_research_rag.llm")

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.model = settings.LLM_MODEL
        
        if self.provider == "gemini" and not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for Gemini LLM generation.")
        elif self.provider == "openai" and not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for OpenAI LLM generation.")

    async def _post_with_retry(self, client: httpx.AsyncClient, url: str, json_data: dict, headers: dict = None, max_retries: int = 7) -> dict:
        """
        Executes a POST request with exponential backoff retries for rate limits (429) and server errors (5xx).
        """
        backoff = 2.0
        for attempt in range(max_retries):
            try:
                response = await client.post(url, json=json_data, headers=headers, timeout=30.0)
                
                if response.status_code == 200:
                    return response.json()
                    
                if response.status_code == 429 or response.status_code >= 500:
                    logger.warning(
                        f"Transient error {response.status_code} from LLM provider. "
                        f"Retrying in {backoff}s... (Attempt {attempt + 1}/{max_retries})"
                    )
                else:
                    raise ValueError(f"LLM request failed with status {response.status_code}: {response.text}")
                    
            except httpx.RequestError as e:
                logger.warning(f"Network connection error during LLM call: {e}. Retrying in {backoff}s... (Attempt {attempt + 1}/{max_retries})")
                
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2.0, 30.0)
            
        raise RuntimeError(f"LLM API call failed after {max_retries} attempts.")

    def _format_contexts(self, contexts: list[dict]) -> str:
        """
        Formats retrieved chunks into numbered context blocks.
        """
        formatted = []
        for idx, ctx in enumerate(contexts, start=1):
            block = (
                f"[Source #{idx}]\n"
                f"URL: {ctx.get('source_url', 'Unknown')}\n"
                f"Title: {ctx.get('source_title', 'Unknown Page')}\n"
                f"Section: {ctx.get('section_header', 'General')}\n"
                f"Content: {ctx.get('content', '')}\n"
                f"----------------------------------------"
            )
            formatted.append(block)
        return "\n".join(formatted)

    def _parse_used_citations(self, answer: str, contexts: list[dict]) -> list[dict]:
        """
        Scans generated answer for citation markers like [1], [Source #1], or [Source 1]
        and returns the corresponding list of unique source metadata records.
        """
        # Find all numbers within brackets e.g. [1], [Source #1], [Source 1]
        markers = re.findall(r"\[(?:Source\s*#?)?(\d+)\]", answer)
        used_indices = set(int(m) for m in markers)
        
        citations = []
        seen_urls = set()
        
        for idx in sorted(used_indices):
            # Check range boundary safety (1-indexed)
            if 1 <= idx <= len(contexts):
                ctx = contexts[idx - 1]
                url = ctx.get("source_url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    # Include snippet (content excerpt) and relevance_score (rrf_score)
                    # so the frontend Evidence Drawer can display both fields
                    raw_content = ctx.get("content", "")
                    snippet = raw_content[:300].strip() if raw_content else ""
                    rrf_score = ctx.get("rrf_score")
                    citations.append({
                        "index": idx,
                        "url": url,
                        "title": ctx.get("source_title", "Unknown Page"),
                        "source_type": ctx.get("source_type", "general"),
                        "section_header": ctx.get("section_header", "General"),
                        "snippet": snippet,
                        "relevance_score": round(rrf_score, 4) if rrf_score is not None else None,
                    })
        return citations

    async def generate_grounded_answer(self, question: str, contexts: list[dict]) -> dict:
        """
        Generates a grounded, factual answer using Gemini or OpenAI models,
        and computes the citation source mappings.
        """
        if not contexts:
            return {
                "answer": "No relevant company information was retrieved. I cannot answer the question without source contexts.",
                "citations": []
            }

        formatted_contexts = self._format_contexts(contexts)
        
        system_prompt = (
            "You are an expert corporate research analyst and company intelligence assistant.\n"
            "You have been given retrieved source context blocks from the company's official website.\n\n"
            "RESPONSE RULES:\n"
            "1. PRIMARY MODE — Factual questions: If the context directly answers the question, answer using ONLY facts from the context. Cite source numbers in square brackets, e.g. [1] or [2].\n"
            "2. INFERENTIAL MODE — General/career/advisory questions (e.g. 'what skills should I learn to join this company?', 'how do I prepare for an interview here?'): "
            "Use the retrieved context as background knowledge about the company — its products, technologies, business divisions, culture — and combine with your general expertise to give a helpful, specific, and practical answer. "
            "Still cite any context facts you use with [source number]. Clearly frame inferred advice with phrases like 'Based on what this company does...' or 'Given their focus on...'.\n"
            "3. SPECULATION GUARD — If a question asks for future predictions, unreleased data, or financial forecasts not in the context, say: \"I cannot find sufficient information in the retrieved source pages to answer this question.\"\n"
            "4. Do not cite sources that are not in the context list.\n"
            "5. Do not hallucinate specific figures, names, or facts not present in the context."
        )

        user_content = (
            f"Context Blocks:\n"
            f"{formatted_contexts}\n\n"
            f"Research Question: {question}\n\n"
            f"Grounded Answer (remember to cite sources like [1]):"
        )

        async with httpx.AsyncClient() as client:
            if self.provider == "gemini":
                # REST endpoint for generateContent
                url = f"https://generativelanguage.googleapis.com/v1beta/{self.model}:generateContent?key={settings.GEMINI_API_KEY}"
                
                payload = {
                    "contents": [{
                        "parts": [{"text": f"{system_prompt}\n\n{user_content}"}]
                    }]
                }
                
                response_data = await self._post_with_retry(client, url, payload)
                
                try:
                    candidates = response_data.get("candidates", [])
                    answer_text = candidates[0]["content"]["parts"][0]["text"].strip()
                except (KeyError, IndexError) as e:
                    logger.error(f"Error parsing Gemini LLM response: {e}. Raw response: {response_data}")
                    raise ValueError(f"Unexpected response structure from Gemini API: {response_data}")

            elif self.provider == "openai":
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.0  # Force maximum grounding
                }
                
                response_data = await self._post_with_retry(client, url, payload, headers=headers)
                
                try:
                    answer_text = response_data["choices"][0]["message"]["content"].strip()
                except (KeyError, IndexError) as e:
                    logger.error(f"Error parsing OpenAI LLM response: {e}. Raw response: {response_data}")
                    raise ValueError(f"Unexpected response structure from OpenAI API: {response_data}")
            else:
                raise ValueError(f"Unsupported LLM provider: {self.provider}")

            # Parse citations used by the model
            citations = self._parse_used_citations(answer_text, contexts)
            
            return {
                "answer": answer_text,
                "citations": citations
            }
