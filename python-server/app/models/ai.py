"""AI response related models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .emails import EmailData


class SmartReplySuggestion(BaseModel):
    type: str
    text: str
    emoji: Optional[str] = None
    tone: Optional[str] = None
    id: Optional[str] = None
    selected: Optional[bool] = None


class GenerateResponseRequest(BaseModel):
    emailData: EmailData
    userInstruction: str
    options: Dict[str, Any] = Field(default_factory=dict)


class GenerateResponseResponse(BaseModel):
    success: bool = True
    suggestions: List[SmartReplySuggestion]
    analysis: Dict[str, Any]
    metadata: Dict[str, Any]


class SummaryRequest(BaseModel):
    emailId: str
    emailData: EmailData
    options: Dict[str, Any] = Field(default_factory=dict)
