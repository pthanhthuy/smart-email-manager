"""Tone adjustment related models."""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class ToneAdjustmentRequest(BaseModel):
    response: str
    targetTone: str
    options: Dict[str, str] = Field(default_factory=dict)


class ToneAdjustmentResponse(BaseModel):
    success: bool = True
    originalResponse: str
    adjustedResponse: str
    targetTone: str
    metadata: Dict[str, str]


class ToneAnalysisRequest(BaseModel):
    response: str


class ToneAnalysisResponse(BaseModel):
    success: bool = True
    analysis: Dict[str, Any]
    metadata: Dict[str, str]


class ToneOptionsResponse(BaseModel):
    success: bool = True
    toneOptions: List[Dict[str, str]]


class ToneBatchAdjustmentRequest(BaseModel):
    responses: List[Dict[str, str]]
    targetTone: str


class ToneBatchAdjustmentResponse(BaseModel):
    success: bool = True
    adjustedResponses: List[Dict[str, str]]
    targetTone: str
    count: int
