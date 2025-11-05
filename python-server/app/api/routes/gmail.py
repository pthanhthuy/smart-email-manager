"""Gmail integration routes."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.deps import get_settings_dep
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import SaveDraftRequest
from app.services import emails as email_utils
from app.services.gmail import create_gmail_draft, get_gmail_service

router = APIRouter(prefix="", tags=["gmail"])
logger = get_logger(__name__)


@router.get("/test-gmail")
async def test_gmail(settings: Settings = Depends(get_settings_dep)) -> dict:
    try:
        gmail = get_gmail_service(settings)
        profile = gmail.users().getProfile(userId="me").execute()
        return {
            "success": True,
            "message": "Gmail connected!",
            "emailAddress": profile.get("emailAddress"),
            "totalMessages": profile.get("messagesTotal"),
            "threadsTotal": profile.get("threadsTotal"),
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Gmail test error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure credentials.json is configured."},
        )


@router.get("/emails")
async def get_emails(max: int = Query(10, ge=1, le=500), settings: Settings = Depends(get_settings_dep)) -> dict:  # pylint: disable=redefined-builtin
    try:
        gmail = get_gmail_service(settings)
        response = gmail.users().messages().list(userId="me", maxResults=max, q="-category:promotions -category:social").execute()
        message_refs = response.get("messages", [])
        emails: List[Dict[str, Any]] = []
        for message_ref in message_refs:
            detail = gmail.users().messages().get(userId="me", id=message_ref["id"], format="full").execute()
            parsed = email_utils.parse_email(detail)
            emails.append(
                {
                    "id": parsed.get("id"),
                    "subject": parsed.get("subject"),
                    "from": parsed.get("from"),
                    "date": parsed.get("date"),
                    "snippet": parsed.get("snippet"),
                }
            )
        return {
            "success": True,
            "count": len(emails),
            "emails": emails,
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Fetch emails error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/save-draft")
async def save_draft(payload: SaveDraftRequest, settings: Settings = Depends(get_settings_dep)) -> dict:
    email_id = payload.emailId
    response_text = payload.responseText
    tone = payload.tone or "professional"
    if not email_id or not response_text:
        return JSONResponse(status_code=400, content={"success": False, "error": "emailId and responseText are required"})

    try:
        # Fetch original email to get metadata (recipient, subject, threadId)
        gmail = get_gmail_service(settings)
        original_message = gmail.users().messages().get(userId="me", id=email_id, format="full").execute()
        parsed_email = email_utils.parse_email(original_message)
        
        # Extract recipient (from original email's "from" field - this becomes "to" in reply)
        from_header = parsed_email.get("from", "")
        recipient = email_utils.extract_email_address(from_header)
        if not recipient:
            recipient = from_header if from_header else "recipient@example.com"  # Fallback
        
        # Extract and format subject
        original_subject = parsed_email.get("subject", "No Subject")
        # Add "Re: " prefix if not already present
        if original_subject and not original_subject.startswith("Re: "):
            reply_subject = f"Re: {original_subject}"
        else:
            reply_subject = original_subject if original_subject else "Re: Your Email"
        
        # Get threadId for email threading
        thread_id = parsed_email.get("threadId")
        
        # Create draft with correct metadata
        draft_result = create_gmail_draft(
            to=recipient,
            subject=reply_subject,
            body=response_text,
            thread_id=thread_id,
            settings=settings
        )
        
        return {
            "success": True,
            "message": "Draft saved to Gmail successfully!",
            "draft": {
                "id": draft_result.get("draftId"),
                "snippet": (response_text or "")[:100] + "...",
            },
            "metadata": {
                "recipient": recipient,
                "subject": reply_subject,
                "tone": tone,
                "threadId": thread_id,
            },
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Draft saving error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Ensure Gmail credentials have compose permissions."},
        )
