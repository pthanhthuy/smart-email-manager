"""
Email Summary TTS API endpoints for reading AI-generated summaries.
"""

from fastapi import APIRouter, HTTPException, Query, Path, Depends, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import io
import hashlib

from app.services.summary_tts import EmailSummaryTTSService
from app.api.deps import get_ai_service, get_settings_dep
from app.core.config import Settings
from app.core.logging import get_logger
from app.services.ai_responses import AIResponseService
from app.services import emails as email_utils
from app.services.gmail import get_gmail_service

logger = get_logger(__name__)
router = APIRouter(prefix="/summary-tts", tags=["email-summary-speech"])

# Initialize TTS service
summary_tts_service = EmailSummaryTTSService()


class SummaryTTSRequest(BaseModel):
    email_id: Optional[str] = None  # Optional since it comes from path parameter
    language: Optional[str] = None  # Optional since it comes from query parameter
    summary_text: Optional[str] = None  # If provided, use this summary instead of generating
    email_data: Optional[Dict[str, Any]] = None  # Email data for generating summary if summary_text not provided


@router.post("/generate/{email_id}")
async def generate_summary_speech(
    email_id: str = Path(..., description="Email ID to generate summary speech for"),
    language: str = Query("en", description="Language for speech generation"),
    request_data: Optional[SummaryTTSRequest] = Body(None),
    ai_service: Optional[AIResponseService] = Depends(get_ai_service),
    settings: Settings = Depends(get_settings_dep)
):
    """Generate speech for an email's AI summary."""
    try:
        # Get summary text from request, or generate it
        summary_text = None
        
        if request_data and request_data.summary_text:
            # Use provided summary text
            summary_text = request_data.summary_text
            logger.info(f"Using provided summary text for email {email_id}")
        elif request_data and request_data.email_data:
            # Generate summary from provided email data
            logger.info(f"Generating summary from provided email data for {email_id}")
            summary_result = await ai_service.generate_email_summary(request_data.email_data, {})
            summary_text = summary_result.get("summary")
        else:
            # Try to fetch email from Gmail and generate summary
            logger.info(f"Fetching email {email_id} from Gmail to generate summary")
            try:
                gmail = get_gmail_service(settings)
                message = gmail.users().messages().get(userId="me", id=email_id, format="full").execute()
                email_data = email_utils.parse_email(message)
                
                # Generate AI summary
                summary_result = await ai_service.generate_email_summary(email_data, {})
                summary_text = summary_result.get("summary")
                logger.info(f"Generated summary for email {email_id}")
            except Exception as e:
                logger.warning(f"Failed to fetch email from Gmail: {e}. Using fallback summary.")
                # Fallback to a basic summary if we can't fetch the email
                summary_text = f"This email requires your attention. Please review the full email content."
        
        if not summary_text or not summary_text.strip():
            raise HTTPException(status_code=400, detail="Could not generate or retrieve summary text")
        
        # Generate hash for caching
        summary_hash = hashlib.md5(summary_text.encode()).hexdigest()
        
        # Generate speech
        audio_bytes = await summary_tts_service.generate_summary_speech(
            summary_text=summary_text,
            email_id=email_id,
            summary_hash=summary_hash,
            language=language
        )
        
        # Estimate duration
        duration = await summary_tts_service.get_summary_duration_estimate(summary_text)
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"attachment; filename=summary_{email_id}.wav",
                "X-Duration": str(duration),
                "X-Email-ID": email_id,
                "X-Summary-Length": str(len(summary_text))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summary TTS generation failed for email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-text")
async def generate_speech_from_text(
    text: str = Query(..., description="Text to convert to speech"),
    language: str = Query("en", description="Language for speech generation")
):
    """Generate speech from any text (useful for testing)."""
    try:
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Generate hash for caching
        text_hash = hashlib.md5(text.encode()).hexdigest()
        
        # Generate speech
        audio_bytes = await summary_tts_service.generate_summary_speech(
            summary_text=text,
            email_id=f"text_{text_hash[:8]}",
            summary_hash=text_hash,
            language=language
        )
        
        # Estimate duration
        duration = await summary_tts_service.get_summary_duration_estimate(text)
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"attachment; filename=speech_{text_hash[:8]}.wav",
                "X-Duration": str(duration),
                "X-Text-Length": str(len(text))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/{email_id}/summary-info")
async def get_summary_info(
    email_id: str,
    ai_service: Optional[AIResponseService] = Depends(get_ai_service),
    settings: Settings = Depends(get_settings_dep)
):
    """Get summary information including estimated speech duration."""
    try:
        # Try to get actual summary from email
        summary_text = None
        try:
            gmail = get_gmail_service(settings)
            message = gmail.users().messages().get(userId="me", id=email_id, format="full").execute()
            email_data = email_utils.parse_email(message)
            
            # Generate AI summary
            summary_result = await ai_service.generate_email_summary(email_data, {})
            summary_text = summary_result.get("summary")
            logger.info(f"Generated summary for info request for email {email_id}")
        except Exception as e:
            logger.warning(f"Failed to generate summary for info: {e}")
            # Fallback message
            summary_text = f"This email requires your attention. Please review the full email content."
        
        if not summary_text:
            summary_text = "Unable to generate summary at this time."
        
        # Estimate duration
        duration = await summary_tts_service.get_summary_duration_estimate(summary_text)
        
        return {
            "email_id": email_id,
            "summary_text": summary_text,
            "estimated_duration_seconds": duration,
            "word_count": len(summary_text.split()),
            "has_audio_cache": await summary_tts_service._get_cached_audio(
                summary_tts_service._generate_summary_cache_key(
                    email_id, 
                    hashlib.md5(summary_text.encode()).hexdigest()
                )
            ) is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get summary info for email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def summary_tts_health():
    """Check email summary TTS service health."""
    try:
        await summary_tts_service.initialize_model()
        return {
            "status": "healthy", 
            "model": summary_tts_service.model_name,
            "professional_mode": summary_tts_service.professional_tone,
            "slow_down_factor": summary_tts_service.slow_down_factor,
            "cache_directory": str(summary_tts_service.cache_dir)
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.get("/models")
async def get_available_models():
    """Get information about available TTS models."""
    return {
        "current_model": summary_tts_service.model_name,
        "fallback_models": summary_tts_service.fallback_models,
        "professional_tone": summary_tts_service.professional_tone,
        "slow_down_factor": summary_tts_service.slow_down_factor
    }
