"""Response history routes."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.deps import get_history_service
from app.core.logging import get_logger
from app.models import (
    ResponseHistoryDraftRequest,
    ResponseHistoryQueryParams,
    ResponseHistorySelectRequest,
)
from app.services.history import ResponseHistoryService

router = APIRouter(prefix="", tags=["history"])
logger = get_logger(__name__)


@router.get("/response-history")
async def response_history(
    status: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    startDate: str | None = Query(None),
    endDate: str | None = Query(None),
    sender: str | None = Query(None),
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    try:
        options = {
            "status": status,
            "limit": limit,
            "startDate": startDate,
            "endDate": endDate,
            "sender": sender,
        }
        return await history_service.get_history(options)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Response history error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/response-history/{history_id}")
async def get_history_entry(
    history_id: str,
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    try:
        return await history_service.get_history_entry(history_id)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Get history entry error: %s", exc)
        return JSONResponse(status_code=404, content={"success": False, "error": str(exc)})


@router.post("/response-history/{history_id}/select")
async def select_history_suggestion(
    history_id: str,
    payload: ResponseHistorySelectRequest,
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    if not payload.suggestionId:
        return JSONResponse(status_code=400, content={"success": False, "error": "suggestionId is required"})
    try:
        return await history_service.mark_suggestion_selected(history_id, payload.suggestionId)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Mark suggestion error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.post("/response-history/{history_id}/saved-to-draft")
async def mark_saved_to_draft(
    history_id: str,
    payload: ResponseHistoryDraftRequest,
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    if not payload.draftId:
        return JSONResponse(status_code=400, content={"success": False, "error": "draftId is required"})
    try:
        return await history_service.mark_saved_to_draft(history_id, payload.draftId)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Mark saved to draft error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.delete("/response-history")
async def clear_response_history(
    all: bool = Query(False),  # pylint: disable=redefined-builtin
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    try:
        return await history_service.clear_history(all)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Clear history error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/user-preferences")
async def user_preferences(
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    try:
        return await history_service.get_user_preferences()
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("User preferences error: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/test-history")
async def test_history(
    history_service: ResponseHistoryService = Depends(get_history_service),
) -> dict:
    try:
        return await history_service.test_with_sample_data()
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("History test error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Check response history service configuration"},
        )
