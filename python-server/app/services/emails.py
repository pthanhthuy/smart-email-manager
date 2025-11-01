"""Email parsing utilities adapted from `server/emailService.js`."""

from __future__ import annotations

import base64
import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from app.core.logging import get_logger

logger = get_logger(__name__)

URGENT_KEYWORDS = [
    "urgent",
    "asap",
    "important",
    "critical",
    "deadline",
    "action required",
    "immediate",
    "emergency",
]


def html_to_text(html: str) -> str:
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    for script in soup(["script", "style"]):
        script.extract()
    text = soup.get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def decode_body(data: Optional[str]) -> str:
    if not data:
        return ""
    decoded = base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
    return decoded


def extract_email_body(payload: Dict[str, Any]) -> str:
    if not payload:
        return ""

    body = ""
    if payload.get("body", {}).get("data"):
        body = decode_body(payload["body"]["data"])
        if payload.get("mimeType") == "text/html":
            body = html_to_text(body)

    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            body += "\n" + decode_body(part["body"]["data"])
        elif part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
            body += "\n" + html_to_text(decode_body(part["body"]["data"]))
        elif part.get("parts"):
            body += "\n" + extract_email_body(part)
    return body.strip()


def parse_email(message: Dict[str, Any]) -> Dict[str, Any]:
    headers = {h["name"].lower(): h["value"] for h in message.get("payload", {}).get("headers", []) if "name" in h}
    body = extract_email_body(message.get("payload", {}))

    snippet = message.get("snippet", "")
    final_body = body if body else snippet

    email_obj = {
        "id": message.get("id"),
        "threadId": message.get("threadId"),
        "messageId": headers.get("message-id", message.get("id")),
        "subject": headers.get("subject", "No subject"),
        "from": headers.get("from", "Unknown"),
        "to": headers.get("to", ""),
        "date": headers.get("date", ""),
        "body": final_body,
        "snippet": snippet,
        "labels": message.get("labelIds", []),
        "internalDate": message.get("internalDate"),
    }

    email_obj["important"] = is_important(email_obj)
    return email_obj


def prepare_email_for_embedding(email: Dict[str, Any]) -> str:
    subject = email.get("subject") or "No subject"
    body = email.get("body") or email.get("snippet") or ""
    text = f"Subject: {subject}\n\nBody: {body}"
    max_length = 2000 * 5
    if len(text) > max_length:
        logger.warning("Email truncated for embedding (len=%s)", len(text))
        return text[:max_length] + "..."
    return text


def extract_email_address(from_field: str) -> str:
    if not from_field:
        return ""
    match = re.search(r"<(.+?)>", from_field)
    return match.group(1) if match else from_field.strip()


def extract_sender_name(from_field: str) -> str:
    if not from_field:
        return "Unknown"
    match = re.match(r'^(.+?)\s*<', from_field)
    if match:
        return match.group(1).strip('"\' ')
    return extract_email_address(from_field)


def format_date(date_str: str) -> str:
    from dateutil import parser  # type: ignore

    if not date_str:
        return ""
    try:
        return parser.parse(date_str).isoformat()
    except (ValueError, TypeError):
        return date_str


def is_important(email: Dict[str, Any]) -> bool:
    subject = (email.get("subject") or "").lower()
    if any(keyword in subject for keyword in URGENT_KEYWORDS):
        return True
    labels = email.get("labels") or []
    return "IMPORTANT" in labels
