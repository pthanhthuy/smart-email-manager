"""Email-related Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator


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
    labels: Optional[Union[List[str], str]] = None
    internalDate: Optional[str] = None
    important: Optional[bool] = None
    category: Optional[str] = Field(
        None, description="Email category: work, personal, promotion, etc."
    )
    categoryConfidence: Optional[float] = Field(
        None, description="Classification confidence 0.0-1.0"
    )

    @field_validator('labels', mode='before')
    @classmethod
    def parse_labels(cls, v: Any) -> Optional[List[str]]:
        """Convert labels from string (comma-separated) or list to list format."""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            # Handle comma-separated string (from cache)
            if not v.strip():
                return None
            return [label.strip() for label in v.split(',') if label.strip()]
        return None

    class Config:
        populate_by_name = True
        # Allow extra fields from cached email data
        extra = "allow"


class EmailSearchRequest(BaseModel):
    query: str = ""  # Empty query means get all emails (no semantic search)
    limit: Optional[int] = None  # None means get all emails, otherwise limit results


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
    labels: Optional[str] = Field(
        None, description="Comma-separated list of label IDs"
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


class LabelCreateRequest(BaseModel):
    name: str = Field(..., description="Label name")
    description: str = Field(..., description="Label description")
    prompt: str = Field(
        ..., description="Natural language prompt describing which emails should have this label"
    )
    color: Optional[str] = Field(None, description="Optional color for UI display (hex code)")


class LabelUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    color: Optional[str] = None


class LabelResponse(BaseModel):
    id: str
    name: str
    description: str
    prompt: str
    createdAt: str
    emailCount: int
    color: Optional[str] = None
    updatedAt: Optional[str] = None


class ApplyLabelRequest(BaseModel):
    labelId: str
    emailIds: List[str]


class RemoveLabelRequest(BaseModel):
    labelId: str
    emailIds: List[str]
