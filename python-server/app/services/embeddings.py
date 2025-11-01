"""
Embedding service comparable to `server/embeddingService.js`.
"""

from __future__ import annotations

from typing import Iterable, List

from openai import OpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services import emails as email_utils

logger = get_logger(__name__)


class EmbeddingService:
    """Wrapper around OpenAI embeddings API."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        api_key = self.settings.embedding_api_key
        if not api_key:
            raise ValueError("Embedding API key is not configured.")
        self.client = OpenAI(
            api_key=api_key,
            base_url=self.settings.openai_base_url,
        )
        self.model = self.settings.embedding_model

    async def generate_embedding(self, text: str) -> List[float]:
        if not text.strip():
            raise ValueError("Text cannot be empty.")
        logger.info("Generating embedding (len=%s)", len(text))
        response = self.client.embeddings.create(
            model=self.model,
            input=text,
            encoding_format="float",
        )
        return list(response.data[0].embedding)

    async def generate_embeddings(self, texts: Iterable[str]) -> List[List[float]]:
        texts_list = list(texts)
        if not texts_list:
            raise ValueError("No texts provided for embedding.")
        logger.info("Generating %s embeddings", len(texts_list))
        response = self.client.embeddings.create(
            model=self.model,
            input=texts_list,
            encoding_format="float",
        )
        return [list(item.embedding) for item in response.data]

    async def generate_email_embeddings(self, email_dicts: List[dict]) -> List[dict]:
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
