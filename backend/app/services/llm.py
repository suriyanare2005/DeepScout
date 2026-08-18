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

    async def _post_with_retry(self, client: httpx.AsyncClient, url: str, json_data: dict, headers: dict = None, max_retries: int = 5) -> dict:
        """
        Executes a POST request with exponential backoff retries for rate limits (429) and server errors (5xx).
        """
        backoff = 1.0
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
            backoff *= 2.0
            
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
                    citations.append({
                        "index": idx,
                        "url": url,
                        "title": ctx.get("source_title", "Unknown Page"),
                        "source_type": ctx.get("source_type", "general"),
                        "section_header": ctx.get("section_header", "General")
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
            "You are an expert, objective corporate research analyst.\n"
            "Answer the user's research question using ONLY the retrieved source context blocks below.\n\n"
            "STRICT RULES:\n"
            "1. Rely only on clear facts stated directly in the context blocks. Do NOT invent information or draw speculative conclusions.\n"
            "2. If the context does not contain the answer, say exactly: \"I cannot find sufficient information in the retrieved source pages to answer this question.\" Do not answer from your pre-trained general knowledge about this company.\n"
            "3. For every statement or claim supported by a source block, cite the source number in square brackets at the end of the sentence, e.g. [1] or [2] (matching the '[Source #1]' layout).\n"
            "4. Do not cite sources that are not in the context list."
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
