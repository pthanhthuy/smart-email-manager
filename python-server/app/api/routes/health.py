"""System level routes."""

from datetime import datetime

from fastapi import APIRouter, Depends

from app.api.deps import get_settings_dep, get_vector_store
from app.core.config import Settings
from app.services.vector_store import VectorStore

router = APIRouter(tags=["system"])


@router.get("/health")
async def health(settings: Settings = Depends(get_settings_dep)) -> dict:
    return {
        "success": True,
        "status": "ok",
        "message": "Smart Email Manager Python server",
        "environment": settings.node_env,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/stats")
async def stats(vector_store: VectorStore = Depends(get_vector_store)) -> dict:
    try:
        data = vector_store.stats()
        return {"success": True, **data}
    except Exception as exc:  # pylint: disable=broad-except
        return {"success": False, "error": str(exc)}
