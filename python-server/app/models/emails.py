"""Email-related Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EmailData(BaseModel):
    id: str
    threadId: Optional[str] = None
    messageId: Optional[str] = None
    subject: Optional[str] = None
    from_: Optional[str] = Field(None, alias="from")
    to: Optional[str] = None
    date: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    labels: Optional[List[str]] = None
    internalDate: Optional[str] = None
    important: Optional[bool] = None
    category: Optional[str] = Field(
        None, description="Email category: work, personal, promotion, etc."
    )
    categoryConfidence: Optional[float] = Field(
        None, description="Classification confidence 0.0-1.0"
    )

    class Config:
        populate_by_name = True


class EmailSearchRequest(BaseModel):
    query: str
    limit: int = 10


class EmailSearchResult(BaseModel):
    rank: int
    id: str
    subject: Optional[str] = None
    from_: Optional[str] = Field(None, alias="from")
    date: Optional[str] = None
    snippet: Optional[str] = None
    body: Optional[str] = None  # Full email body/content
    similarity: Optional[int] = None
    distance: Optional[float] = None
    threadId: Optional[str] = None
    category: Optional[str] = Field(
        None, description="Email category: work, personal, promotion, etc."
    )
    categoryConfidence: Optional[float] = Field(
        None, description="Classification confidence 0.0-1.0"
    )

    class Config:
        populate_by_name = True


class EmailSummaryResponse(BaseModel):
    success: bool = True
    summary: str
    metadata: Dict[str, Any]
    emailId: str
    emailSubject: Optional[str] = None
    generatedAt: datetime = Field(default_factory=datetime.utcnow)


class SaveDraftRequest(BaseModel):
    emailId: str
    responseText: str
    tone: Optional[str] = None


class EmailClassificationRequest(BaseModel):
    emailId: Optional[str] = None
    emailData: Optional[Dict[str, Any]] = None
    category: Optional[str] = None  # For manual override
    manualOverride: Optional[bool] = False


class EmailClassificationResponse(BaseModel):
    category: str
    confidence: float
    reasoning: Optional[str] = None
    emailId: Optional[str] = None
