"""Synchronization and semantic search routes."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_embedding_service, get_settings_dep, get_vector_store
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import EmailSearchRequest, EmailSearchResult
from app.services import emails as email_utils
from app.services.embeddings import EmbeddingService
from app.services.gmail import get_gmail_service
from app.services.vector_store import VectorStore

router = APIRouter(prefix="", tags=["search"])
logger = get_logger(__name__)


@router.post("/sync")
async def sync_emails(
    settings: Settings = Depends(get_settings_dep),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    try:
        gmail = get_gmail_service(settings)
        max_emails = settings.max_emails
        logger.info("Syncing up to %s emails from Gmail", max_emails)
        response = gmail.users().messages().list(
            userId="me",
            maxResults=max_emails,
            q="-category:promotions -category:social",
        ).execute()
        message_refs = response.get("messages", [])
        if not message_refs:
            return {"success": True, "indexed": 0, "message": "No emails to sync"}

        emails: List[Dict[str, Any]] = []
        for message_ref in message_refs:
            detail = gmail.users().messages().get(userId="me", id=message_ref["id"], format="full").execute()
            emails.append(email_utils.parse_email(detail))

        emails_with_embeddings = await embeddings.generate_email_embeddings(emails)
        indexed = vector_store.add_emails(emails_with_embeddings)

        return {
            "success": True,
            "indexed": indexed,
            "message": f"Successfully indexed {indexed} emails!",
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Sync error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Check server logs for details"},
        )


@router.post("/search")
async def semantic_search(
    payload: EmailSearchRequest,
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    if not payload.query:
        return JSONResponse(status_code=400, content={"success": False, "error": "Query is required"})
    try:
        embedding = await embeddings.generate_embedding(payload.query)
        results = vector_store.search(embedding, limit=payload.limit)
        formatted: List[EmailSearchResult] = []
        for index, result in enumerate(results):
            metadata = result.get("metadata", {})
            # Get full email body from document field (contains full content)
            document = result.get("document")
            formatted.append(
                EmailSearchResult(
                    rank=index + 1,
                    id=result.get("id"),
                    subject=metadata.get("subject"),
                    from_=metadata.get("from"),
                    date=metadata.get("date"),
                    snippet=metadata.get("snippet"),
                    body=document,  # Full email content from ChromaDB document field
                    similarity=int(result.get("similarity", 0) * 100) if result.get("similarity") else None,
                    distance=result.get("distance"),
                    threadId=metadata.get("threadId"),
                )
            )
        return {
            "success": True,
            "query": payload.query,
            "count": len(formatted),
            "results": [item.dict(by_alias=True) for item in formatted],
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Search error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure you have run /sync first to index emails"},
        )
