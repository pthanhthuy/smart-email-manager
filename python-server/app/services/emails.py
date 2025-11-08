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
    """Extract email body from Gmail message payload, avoiding duplicates.
    
    Gmail messages can have body content in multiple places:
    - payload.body.data (for simple emails)
    - payload.parts[].body.data (for multipart emails)
    - Sometimes the same content appears in both, causing duplication
    
    This function prefers parts over direct body, and deduplicates content.
    """
    if not payload:
        return ""

    body_parts = []
    seen_content = set()  # Track seen content to avoid duplicates
    
    # If payload has parts, prefer extracting from parts (more reliable for multipart emails)
    if payload.get("parts"):
        # First pass: collect text/plain parts
        text_parts = []
        html_parts = []
        
        for part in payload.get("parts", []):
            part_result = _extract_part_body(part, seen_content)
            if part_result:
                mime_type = part.get("mimeType", "")
                if mime_type == "text/plain":
                    text_parts.append(part_result)
                elif mime_type == "text/html":
                    html_parts.append(part_result)
                else:
                    body_parts.append(part_result)
        
        # Prefer text/plain over text/html if both exist
        if text_parts:
            body_parts.extend(text_parts)
        elif html_parts:
            body_parts.extend(html_parts)
    else:
        # Simple email without parts - extract from payload.body directly
        if payload.get("body", {}).get("data"):
            body = decode_body(payload["body"]["data"])
            mime_type = payload.get("mimeType", "")
            if mime_type == "text/html":
                body = html_to_text(body)
            if body and body not in seen_content:
                body_parts.append(body)
                seen_content.add(body)
    
    # Join all unique body parts
    result = "\n".join(body_parts).strip()
    return result


def _extract_part_body(part: Dict[str, Any], seen_content: set) -> str:
    """Extract body from a single part, avoiding duplicates."""
    if not part:
        return ""
    
    mime_type = part.get("mimeType", "")
    
    # If this part has nested parts, extract from them recursively
    if part.get("parts"):
        nested_parts = []
        for nested_part in part.get("parts", []):
            nested_body = _extract_part_body(nested_part, seen_content)
            if nested_body:
                nested_parts.append(nested_body)
        return "\n".join(nested_parts)
    
    # Extract body data from this part
    if part.get("body", {}).get("data"):
        body = decode_body(part["body"]["data"])
        
        # Convert HTML to text if needed
        if mime_type == "text/html":
            body = html_to_text(body)
        
        # Only add if we haven't seen this exact content before
        # Use a normalized version (strip whitespace) for comparison
        normalized_body = body.strip() if body else ""
        if normalized_body and normalized_body not in seen_content:
            seen_content.add(normalized_body)
            return normalized_body
    
    return ""


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
    """Extract email address from formats like 'Name <email@example.com>' or 'email@example.com'."""
    if not from_field:
        return ""
    # Try to extract email from "Name <email@example.com>" format
    match = re.search(r"<(.+?)>", from_field)
    if match:
        return match.group(1).strip()
    # Fallback: try to find email address pattern in the string
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", from_field)
    if email_match:
        return email_match.group(0)
    # Last resort: return stripped string
    return from_field.strip()


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
