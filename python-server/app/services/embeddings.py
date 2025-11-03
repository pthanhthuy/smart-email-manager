"""
Embedding service using LangChain for OpenAI embeddings API.
"""

from __future__ import annotations

from typing import Iterable, List

from langchain_openai import OpenAIEmbeddings

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services import emails as email_utils

logger = get_logger(__name__)


class EmbeddingService:
    """Wrapper around LangChain OpenAI embeddings API."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        api_key = self.settings.embedding_api_key
        if not api_key:
            raise ValueError("Embedding API key is not configured.")
        
        # Initialize LangChain OpenAI embeddings
        self.embeddings = OpenAIEmbeddings(
            model=self.settings.embedding_model,
            openai_api_key=api_key,
            base_url=self.settings.openai_base_url,
        )
        self.model = self.settings.embedding_model

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text using LangChain."""
        if not text.strip():
            raise ValueError("Text cannot be empty.")
        logger.info("Generating embedding (len=%s)", len(text))
        # LangChain's aembed_query for async single embedding
        result = await self.embeddings.aembed_query(text)
        return result

    async def generate_embeddings(self, texts: Iterable[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts using LangChain."""
        texts_list = list(texts)
        if not texts_list:
            raise ValueError("No texts provided for embedding.")
        logger.info("Generating %s embeddings", len(texts_list))
        # LangChain's aembed_documents for async batch embeddings
        results = await self.embeddings.aembed_documents(texts_list)
        return results

    async def generate_email_embeddings(self, email_dicts: List[dict]) -> List[dict]:
        """Generate embeddings for email data and enrich with embedding vectors."""
        logger.info("Processing %s emails for embeddings", len(email_dicts))
        texts = [email_utils.prepare_email_for_embedding(email) for email in email_dicts]
        vectors = await self.generate_embeddings(texts)
        enriched = []
        for email, embedding, text in zip(email_dicts, vectors, texts):
            enriched.append(
                {
                    **email,
                    "embedding": embedding,
                    "embeddingText": text,
                }
            )
        return enriched
