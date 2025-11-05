"""Email classification routes."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_classification_service, get_settings_dep
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import EmailClassificationRequest
from app.services.email_classification import EmailClassificationService
from app.services.gmail import get_gmail_service
from app.services import emails as email_utils

router = APIRouter(prefix="", tags=["classification"])
logger = get_logger(__name__)

CATEGORIES = [
    "work",
    "personal",
    "promotion",
    "marketing",
    "newsletter",
    "notification",
    "social",
    "finance",
    "spam",
    "other",
]


@router.get("/categories")
async def get_categories() -> dict:
    """Get list of available email categories."""
    return {
        "success": True,
        "categories": CATEGORIES,
        "descriptions": {
            "work": "Professional/work-related emails",
            "personal": "Personal communications",
            "promotion": "Marketing emails with sales/discounts",
            "marketing": "Marketing newsletters and campaigns",
            "newsletter": "Subscribed newsletters",
            "notification": "System notifications and alerts",
            "social": "Social media notifications",
            "finance": "Financial and banking communications",
            "spam": "Unsolicited or suspicious emails",
            "other": "Uncategorized emails",
        },
    }


@router.post("/classify-email")
async def classify_email(
    payload: EmailClassificationRequest,
    classification_service: EmailClassificationService = Depends(get_classification_service),
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    """Classify a single email."""
    try:
        email_data = payload.emailData
        email_id = payload.emailId

        # Handle manual override
        if payload.manualOverride and payload.category:
            # Return the manually specified category
            return {
                "success": True,
                "classification": {
                    "category": payload.category,
                    "confidence": 1.0,
                    "reasoning": "Manually overridden by user",
                    "emailId": email_id,
                },
            }

        # Fetch email from Gmail if only emailId is provided
        if not email_data and email_id:
            try:
                gmail = get_gmail_service(settings)
                message = (
                    gmail.users()
                    .messages()
                    .get(userId="me", id=email_id, format="full")
                    .execute()
                )
                email_data = email_utils.parse_email(message)
            except Exception as e:
                logger.error("Failed to fetch email from Gmail: %s", e)
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "error": f"Email not found: {str(e)}"},
                )

        if not email_data:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "emailId or emailData required"},
            )

        # Convert to dict if it's a Pydantic model
        if hasattr(email_data, "dict"):
            email_data = email_data.dict(by_alias=True)
        elif not isinstance(email_data, dict):
            email_data = dict(email_data)

        classification = await classification_service.classify_email(email_data)

        return {
            "success": True,
            "classification": {
                "category": classification["category"],
                "confidence": classification["confidence"],
                "reasoning": classification.get("reasoning"),
                "emailId": email_data.get("id") or email_id,
            },
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Classification error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.post("/classify-emails")
async def classify_emails_batch(
    emails: List[Dict[str, Any]],
    classification_service: EmailClassificationService = Depends(get_classification_service),
) -> dict:
    """Classify multiple emails."""
    try:
        if not emails:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Empty emails list"},
            )

        classified = await classification_service.classify_emails_batch(emails)
        return {
            "success": True,
            "count": len(classified),
            "emails": classified,
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Batch classification error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )

