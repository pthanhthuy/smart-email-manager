"""
Gmail integration utilities mirroring `server/gmailAuth.js`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
]


def _read_credentials(credentials_path: Path) -> dict:
    try:
        with credentials_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Gmail credentials not found at {credentials_path}. "
            "Download OAuth credentials and place them at the configured path."
        )


def _load_token(token_path: Path) -> Optional[Credentials]:
    if not token_path.exists():
        return None
    with token_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return Credentials.from_authorized_user_info(data, SCOPES)


def _save_token(credentials: Credentials, token_path: Path) -> None:
    token_path.parent.mkdir(parents=True, exist_ok=True)
    with token_path.open("w", encoding="utf-8") as f:
        f.write(credentials.to_json())
    logger.info("Saved Gmail OAuth token to %s", token_path)


def get_gmail_service(settings: Optional[Settings] = None):
    """Return an authenticated Gmail API client."""
    settings = settings or get_settings()
    token = _load_token(settings.token_path)

    if token and token.valid:
        creds = token
    elif token and token.expired and token.refresh_token:
        try:
            token.refresh(Request())  # type: ignore[name-defined]
            creds = token
            _save_token(creds, settings.token_path)
        except Exception as e:
            # Refresh token is invalid/revoked, need to re-authenticate
            logger.warning("Token refresh failed (%s). Re-authenticating...", e)
            # Delete invalid token file
            if settings.token_path.exists():
                settings.token_path.unlink()
            token = None
    
    if not token or not token.valid:
        # Need to authenticate
        logger.info("Starting OAuth flow. Please complete authentication in your browser.")
        creds_data = _read_credentials(settings.credentials_path)
        flow = InstalledAppFlow.from_client_config(creds_data, SCOPES)
        creds = flow.run_local_server(port=0)
        _save_token(creds, settings.token_path)

    service = build("gmail", "v1", credentials=creds)
    return service


def create_gmail_draft(
    to: str,
    subject: str,
    body: str,
    thread_id: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> dict:
    """Create a Gmail draft mirroring `createGmailDraft` in Node."""
    from base64 import urlsafe_b64encode

    service = get_gmail_service(settings)

    message_lines = [f"To: {to}", f"Subject: {subject}", "", body]
    message = "\n".join(message_lines).encode("utf-8")
    encoded_message = urlsafe_b64encode(message).decode("utf-8")

    payload = {"message": {"raw": encoded_message}}
    if thread_id:
        payload["message"]["threadId"] = thread_id

    try:
        response = (
            service.users()
            .drafts()
            .create(userId="me", body=payload)
            .execute()
        )
        return {
            "success": True,
            "draftId": response.get("id"),
            "messageId": response.get("message", {}).get("id"),
            "threadId": response.get("message", {}).get("threadId"),
            "snippet": response.get("message", {}).get("snippet"),
        }
    except HttpError as exc:
        logger.error("Failed to create Gmail draft: %s", exc)
        raise
