"""Dependency injection utilities for FastAPI routers."""

from functools import lru_cache

from app.core.config import Settings, get_settings
from app.services.ai_responses import AIResponseService
from app.services.embeddings import EmbeddingService
from app.services.email_classification import EmailClassificationService
from app.services.history import ResponseHistoryService
from app.services.tone import ToneAdjustmentService
from app.services.vector_store import VectorStore


def get_settings_dep() -> Settings:
    return get_settings()


@lru_cache
def _embedding_service() -> EmbeddingService:
    return EmbeddingService(get_settings())


@lru_cache
def _vector_store() -> VectorStore:
    return VectorStore(get_settings())


@lru_cache
def _ai_service() -> AIResponseService:
    return AIResponseService(get_settings())


@lru_cache
def _tone_service() -> ToneAdjustmentService:
    return ToneAdjustmentService(get_settings())


@lru_cache
def _history_service() -> ResponseHistoryService:
    return ResponseHistoryService(get_settings())


@lru_cache
def _classification_service() -> EmailClassificationService:
    return EmailClassificationService(get_settings())


def get_embedding_service() -> EmbeddingService:
    return _embedding_service()


def get_vector_store() -> VectorStore:
    return _vector_store()


def get_ai_service() -> AIResponseService:
    return _ai_service()


def get_tone_service() -> ToneAdjustmentService:
    return _tone_service()


def get_history_service() -> ResponseHistoryService:
    return _history_service()


def get_classification_service() -> EmailClassificationService:
    return _classification_service()
