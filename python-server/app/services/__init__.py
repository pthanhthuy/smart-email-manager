"""Service exports for Smart Email Manager."""

from .embeddings import EmbeddingService
from .vector_store import VectorStore
from .gmail import get_gmail_service, create_gmail_draft
from .ai_responses import AIResponseService
from .tone import ToneAdjustmentService
from .history import ResponseHistoryService
from .emails import parse_email, prepare_email_for_embedding
from .email_classification import EmailClassificationService

__all__ = [
    "EmbeddingService",
    "VectorStore",
    "get_gmail_service",
    "create_gmail_draft",
    "AIResponseService",
    "ToneAdjustmentService",
    "ResponseHistoryService",
    "parse_email",
    "prepare_email_for_embedding",
    "EmailClassificationService",
]
