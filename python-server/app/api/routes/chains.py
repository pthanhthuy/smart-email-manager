"""
LangChain chains endpoints for advanced email processing workflows.

Phase 2: Advanced Features
- RAG chains for context-aware responses
- Sequential chains for email processing pipelines
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.api.deps import get_ai_service, get_embedding_service, get_vector_store
from app.core.logging import get_logger
from app.models import GenerateResponseRequest, SummaryRequest
from app.services.email_chains import EmailProcessingChains
from app.services.ai_responses import AIResponseService
from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStore

router = APIRouter(prefix="/chains", tags=["chains"])
logger = get_logger(__name__)


def get_email_chains_service(
    ai_service: AIResponseService = Depends(get_ai_service),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> EmailProcessingChains:
    """Dependency to get EmailProcessingChains service."""
    return EmailProcessingChains(
        ai_service=ai_service,
        embeddings=embeddings,
        vector_store=vector_store,
    )


@router.post("/rag-response")
async def rag_response(
    payload: GenerateResponseRequest,
    chains_service: EmailProcessingChains = Depends(get_email_chains_service),
) -> dict:
    """
    Generate email responses using RAG (Retrieval Augmented Generation).
    
    This endpoint uses semantic search to find similar emails and uses them
    as context to generate more informed and contextually-aware responses.
    
    Request body same as /generate-response:
    {
        "emailData": {...},
        "userInstruction": "I can attend",
        "options": {
            "tone": "professional",
            "contextEmailsLimit": 3
        }
    }
    """
    if not payload.emailData or not payload.userInstruction:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Email data and user instruction are required"},
        )
    
    try:
        # Extract context emails limit from options
        context_limit = payload.options.get("contextEmailsLimit", 3)
        
        result = await chains_service.rag_response_chain(
            email_data=payload.emailData.dict(by_alias=True),
            user_instruction=payload.userInstruction,
            options=payload.options,
            context_emails_limit=context_limit,
        )
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("RAG chain error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
                "hint": "Make sure vector store is synced and embeddings are configured",
            },
        )


@router.post("/summary-to-tts")
async def summary_to_tts(
    payload: SummaryRequest,
    chains_service: EmailProcessingChains = Depends(get_email_chains_service),
) -> dict:
    """
    Sequential chain: Generate email summary ready for TTS.
    
    This endpoint:
    1. Generates a clear, conversational email summary
    2. Formats it for text-to-speech
    3. Returns summary ready for TTS processing
    
    Request body:
    {
        "emailId": "123",
        "emailData": {...},
        "options": {
            "maxLength": 2000
        }
    }
    """
    if not payload.emailId or not payload.emailData:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "emailId and emailData are required"},
        )
    
    try:
        result = await chains_service.summary_to_tts_chain(
            email_data=payload.emailData.dict(by_alias=True),
            options=payload.options,
        )
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Summary-to-TTS chain error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
                "hint": "Make sure AI service is configured properly",
            },
        )


@router.get("/health")
async def chains_health(
    chains_service: EmailProcessingChains = Depends(get_email_chains_service),
) -> dict:
    """Check chains service health."""
    return {
        "status": "healthy",
        "chains": {
            "rag_response": True,
            "summary_to_tts": True,
        },
        "services": {
            "ai_service": chains_service.ai_service is not None,
            "embeddings": chains_service.embeddings is not None,
            "vector_store": chains_service.vector_store is not None,
        },
    }

