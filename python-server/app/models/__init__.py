"""Pydantic models used across the Smart Email Manager API."""

from .emails import (
    EmailData,
    EmailSearchRequest,
    EmailSearchResult,
    EmailSummaryResponse,
    SaveDraftRequest,
)
from .ai import (
    EmailAnalysis,
    GenerateResponseRequest,
    GenerateResponseResponse,
    SmartReplyOutput,
    SmartReplySuggestion,
    SummaryRequest,
)
from .tone import (
    ToneAdjustmentRequest,
    ToneAdjustmentResponse,
    ToneAnalysisRequest,
    ToneAnalysisResponse,
    ToneOptionsResponse,
    ToneBatchAdjustmentRequest,
    ToneBatchAdjustmentResponse,
)
from .history import (
    ResponseHistoryEntry,
    ResponseHistoryListResponse,
    ResponseHistoryQueryParams,
    ResponseHistorySelectRequest,
    ResponseHistoryDraftRequest,
    UserPreferencesResponse,
)

__all__ = [
    "EmailData",
    "EmailSearchRequest",
    "EmailSearchResult",
    "EmailSummaryResponse",
    "SaveDraftRequest",
    "EmailAnalysis",
    "GenerateResponseRequest",
    "GenerateResponseResponse",
    "SmartReplyOutput",
    "SmartReplySuggestion",
    "SummaryRequest",
    "ToneAdjustmentRequest",
    "ToneAdjustmentResponse",
    "ToneAnalysisRequest",
    "ToneAnalysisResponse",
    "ToneOptionsResponse",
    "ToneBatchAdjustmentRequest",
    "ToneBatchAdjustmentResponse",
    "ResponseHistoryEntry",
    "ResponseHistoryListResponse",
    "ResponseHistoryQueryParams",
    "ResponseHistorySelectRequest",
    "ResponseHistoryDraftRequest",
    "UserPreferencesResponse",
]
