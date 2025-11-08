"""Label management routes for custom email labels."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.api.deps import get_settings_dep, get_vector_store
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import (
    ApplyLabelRequest,
    LabelCreateRequest,
    LabelResponse,
    LabelUpdateRequest,
    RemoveLabelRequest,
)
from app.services.label_service import LabelService
from app.services.vector_store import VectorStore

router = APIRouter(prefix="", tags=["labels"])
logger = get_logger(__name__)


@router.post("/labels")
async def create_label(
    payload: LabelCreateRequest,
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    """Create a new label definition (without auto-applying)."""
    try:
        label_service = LabelService(settings)
        label = await label_service.create_label(
            name=payload.name,
            description=payload.description,
            prompt=payload.prompt,
            color=payload.color,
            auto_apply=False,  # Don't auto-apply - user will click Apply button
        )
        return {
            "success": True,
            "label": label,
            "message": "Label created successfully. Click 'Apply' to apply it to matching emails.",
        }
    except Exception as exc:
        logger.error("Label creation error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.get("/labels")
async def get_all_labels(settings: Settings = Depends(get_settings_dep)) -> dict:
    """Get all custom labels (system labels are available via /labels/system endpoint)."""
    try:
        label_service = LabelService(settings)
        # Only return custom labels - system labels are shown in popup
        labels = label_service.get_all_labels(include_system=False)
        return {"success": True, "count": len(labels), "labels": labels}
    except Exception as exc:
        logger.error("Get labels error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.get("/labels/system")
async def get_system_labels(settings: Settings = Depends(get_settings_dep)) -> dict:
    """Get system category labels (for popup display)."""
    try:
        label_service = LabelService(settings)
        system_labels = label_service.get_system_labels()
        return {"success": True, "count": len(system_labels), "labels": system_labels}
    except Exception as exc:
        logger.error("Get system labels error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.get("/labels/{label_id}")
async def get_label(
    label_id: str, settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Get specific label."""
    try:
        label_service = LabelService(settings)
        label = label_service.get_label(label_id)
        if not label:
            raise HTTPException(status_code=404, detail="Label not found")
        return {"success": True, "label": label}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.put("/labels/{label_id}")
async def update_label(
    label_id: str,
    payload: LabelUpdateRequest,
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    """Update label definition (only for custom labels)."""
    try:
        label_service = LabelService(settings)
        
        # Check if it's a system label
        if label_id.startswith("system_"):
            raise HTTPException(
                status_code=403,
                detail="System labels cannot be updated"
            )
        
        updates = payload.dict(exclude_unset=True)
        label = label_service.update_label(label_id, updates)
        return {"success": True, "label": label}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Update label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: str, settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Delete label (only for custom labels)."""
    try:
        label_service = LabelService(settings)
        
        # Check if it's a system label
        if label_id.startswith("system_"):
            raise HTTPException(
                status_code=403,
                detail="System labels cannot be deleted"
            )
        
        success = label_service.delete_label(label_id)
        if not success:
            raise HTTPException(status_code=404, detail="Label not found")
        return {"success": True, "message": "Label deleted"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as exc:
        logger.error("Delete label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.post("/labels/{label_id}/apply")
async def auto_apply_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Manually trigger auto-apply of label to all matching emails (only for custom labels)."""
    try:
        label_service = LabelService(settings)
        
        # Check if it's a system label
        if label_id.startswith("system_"):
            raise HTTPException(
                status_code=403,
                detail="System labels cannot be applied. They represent existing email categories."
            )
        
        count = await label_service.auto_apply_label(label_id, vector_store)
        return {
            "success": True,
            "message": f"Label applied to {count} emails",
            "emailCount": count,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as exc:
        logger.error("Auto-apply label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.post("/labels/apply")
async def apply_label_to_emails(
    payload: ApplyLabelRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Manually apply label to specific emails."""
    try:
        label_service = LabelService(settings)
        count = label_service.apply_label_to_emails(
            payload.labelId, payload.emailIds, vector_store
        )
        return {
            "success": True,
            "message": f"Label applied to {count} emails",
            "emailCount": count,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Apply label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.post("/labels/remove")
async def remove_label_from_emails(
    payload: RemoveLabelRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Remove label from specific emails."""
    try:
        label_service = LabelService(settings)
        count = label_service.remove_label_from_emails(
            payload.labelId, payload.emailIds, vector_store
        )
        return {
            "success": True,
            "message": f"Label removed from {count} emails",
            "emailCount": count,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Remove label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )

