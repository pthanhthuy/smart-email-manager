"""AI response and summarization routes."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_ai_service
from app.core.logging import get_logger
from app.models import GenerateResponseRequest, SummaryRequest
from app.services.ai_responses import AIResponseService

router = APIRouter(prefix="", tags=["ai"])
logger = get_logger(__name__)


@router.post("/generate-response")
async def generate_response(
    payload: GenerateResponseRequest,
    ai_service: AIResponseService = Depends(get_ai_service),
) -> dict:
    if not payload.emailData or not payload.userInstruction:
        return JSONResponse(status_code=400, content={"success": False, "error": "Email data and user instruction are required"})
    try:
        result = await ai_service.generate_smart_replies(payload.emailData.dict(by_alias=True), payload.userInstruction, payload.options)
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("AI response generation error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure OPENAI_API_KEY is set in .env file"},
        )


@router.post("/summarize-email")
async def summarize_email(
    payload: SummaryRequest,
    ai_service: AIResponseService = Depends(get_ai_service),
) -> dict:
    if not payload.emailId or not payload.emailData:
        return JSONResponse(status_code=400, content={"success": False, "error": "emailId and emailData are required"})
    try:
        # Convert EmailData model to dict, handling both cached and fresh email data
        # Cached emails might have slightly different structure, so we normalize it
        if hasattr(payload.emailData, 'dict'):
            email_dict = payload.emailData.dict(by_alias=True)
        else:
            # If it's already a dict (from cache), use it directly
            email_dict = payload.emailData
        
        # Ensure required fields are present (use snippet if body is missing)
        if not email_dict.get("body") and email_dict.get("snippet"):
            email_dict["body"] = email_dict["snippet"]
        
        # Ensure from field is properly set (handle both 'from' and 'from_' aliases)
        if not email_dict.get("from") and email_dict.get("from_"):
            email_dict["from"] = email_dict["from_"]
        elif not email_dict.get("from"):
            email_dict["from"] = "Unknown"
        
        logger.debug("Summarizing email %s with body length: %s", payload.emailId, len(email_dict.get("body", "") or ""))
        result = await ai_service.generate_email_summary(email_dict, payload.options)
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Email summarization error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure OPENAI_API_KEY is set in .env file"},
        )


@router.get("/test-ai")
async def test_ai(
    ai_service: AIResponseService = Depends(get_ai_service),
) -> dict:
    try:
        result = await ai_service.test_with_sample_email()
        result["message"] = "AI service test completed"
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("AI test error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Check OPENAI_API_KEY in .env file"},
        )
