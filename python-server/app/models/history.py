"""Response history models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .ai import SmartReplySuggestion
from .emails import EmailData


class ResponseHistoryEntry(BaseModel):
    id: str
    timestamp: datetime
    email: Dict[str, Optional[str]]
    userInstruction: str
    suggestions: List[SmartReplySuggestion]
    analysis: Dict[str, Any]
    metadata: Dict[str, Any]
    status: str
    selectedAt: Optional[datetime] = None
    savedToDraftAt: Optional[datetime] = None
    draftId: Optional[str] = None


class ResponseHistoryListResponse(BaseModel):
    success: bool
    count: int
    total: int
    entries: List[ResponseHistoryEntry]
    stats: Optional[Dict[str, int]] = None


class ResponseHistoryQueryParams(BaseModel):
    status: Optional[str] = None
    limit: int = 20
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    sender: Optional[str] = None


class ResponseHistorySelectRequest(BaseModel):
    suggestionId: str


class ResponseHistoryDraftRequest(BaseModel):
    draftId: str


class UserPreferencesResponse(BaseModel):
    success: bool
    preferences: Dict[str, Any]
