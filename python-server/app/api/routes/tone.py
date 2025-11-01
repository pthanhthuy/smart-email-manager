"""Tone adjustment routes."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_tone_service
from app.core.logging import get_logger
from app.models import (
    ToneAdjustmentRequest,
    ToneAnalysisRequest,
    ToneBatchAdjustmentRequest,
)
from app.services.tone import ToneAdjustmentService

router = APIRouter(prefix="", tags=["tone"])
logger = get_logger(__name__)


@router.post("/adjust-tone")
async def adjust_tone(
    payload: ToneAdjustmentRequest,
    tone_service: ToneAdjustmentService = Depends(get_tone_service),
) -> dict:
    if not payload.response or not payload.targetTone:
        return JSONResponse(status_code=400, content={"success": False, "error": "Response and targetTone are required"})
    try:
        return await tone_service.adjust_tone(payload.response, payload.targetTone, payload.options)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Tone adjustment error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure OPENAI_API_KEY is set in .env file"},
        )


@router.get("/tone-options")
async def tone_options(tone_service: ToneAdjustmentService = Depends(get_tone_service)) -> dict:
    try:
        return {"success": True, "toneOptions": tone_service.get_available_tones()}
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Get tone options error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/analyze-tone")
async def analyze_tone(
    payload: ToneAnalysisRequest,
    tone_service: ToneAdjustmentService = Depends(get_tone_service),
) -> dict:
    if not payload.response:
        return JSONResponse(status_code=400, content={"success": False, "error": "Response is required"})
    try:
        return await tone_service.analyze_tone(payload.response)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Tone analysis error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/batch-adjust-tone")
async def batch_adjust_tone(
    payload: ToneBatchAdjustmentRequest,
    tone_service: ToneAdjustmentService = Depends(get_tone_service),
) -> dict:
    if not payload.responses or not payload.targetTone:
        return JSONResponse(status_code=400, content={"success": False, "error": "Responses array and targetTone are required"})
    try:
        return await tone_service.batch_adjust_tone(payload.responses, payload.targetTone)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Batch tone adjustment error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/test-tone")
async def test_tone(
    tone_service: ToneAdjustmentService = Depends(get_tone_service),
) -> dict:
    try:
        return await tone_service.test_with_sample_data()
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Tone test error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Check OPENAI_API_KEY in .env file"},
        )
