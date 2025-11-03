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


# LangChain structured output models
class EmailAnalysis(BaseModel):
    """Analysis of an email for response generation."""
    emailType: str = Field(description="Type of email: meeting_invitation, question, request, announcement, or general")
    urgency: str = Field(description="Urgency level: low, medium, or high")
    originalTone: Optional[str] = Field(default="professional", description="Detected tone from original email")
    keyPoints: List[str] = Field(default_factory=list, description="Key points or important information from the email")
    userIntent: str = Field(description="Summary of what the user wants to communicate")


class SmartReplyOutput(BaseModel):
    """Structured output format for smart reply generation."""
    suggestions: List[SmartReplySuggestion] = Field(description="List of email response suggestions")
    analysis: EmailAnalysis = Field(description="Analysis of the email and user intent")
