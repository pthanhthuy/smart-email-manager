"""
Email Summary Text-to-Speech service using Hugging Face models.
Specialized for reading AI-generated email summaries.
"""

import os
import io
import hashlib
import warnings
from pathlib import Path
from typing import Optional, Dict, Any, List
import torch
import soundfile as sf
from transformers import pipeline, AutoTokenizer, AutoModel
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

# Suppress specific warnings for Bark model
warnings.filterwarnings("ignore", message=".*attention mask.*")
warnings.filterwarnings("ignore", message=".*pad token.*")
warnings.filterwarnings("ignore", message=".*pad_token_id.*")
warnings.filterwarnings("ignore", message=".*eos_token_id.*")
warnings.filterwarnings("ignore", message=".*unexpected behavior.*")
warnings.filterwarnings("ignore", category=UserWarning, module="transformers")

# Optional torchaudio import
try:
    import torchaudio
    TORCHAUDIO_AVAILABLE = True
except ImportError:
    TORCHAUDIO_AVAILABLE = False
    logger = get_logger(__name__)
    logger.warning("torchaudio not available - professional tone adjustments will be skipped")

logger = get_logger(__name__)


class EmailSummaryTTSService:
    """TTS service specialized for email summary reading."""
    
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.model_name = self.settings.tts_model or "suno/bark-small"
        self.model = None
        self.tokenizer = None
        self.vocoder = None
        self.speaker_embeddings = None
        self.cache_dir = Path(self.settings.tts_cache_dir or "./summary_tts_cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        # Email-specific configuration
        self.professional_tone = True
        self.slow_down_factor = 0.9  # Slightly slower for better comprehension
        
        # Fallback models if primary fails
        self.fallback_models = [
            "suno/bark-small",
            "facebook/fastspeech2-en-ljspeech",  # Alternative TTS model
            "suno/bark-small"    # Try again
        ]
        
    async def initialize_model(self):
        """Initialize the TTS model optimized for email summaries."""
        if self.model is not None:
            return
            
        logger.info(f"Loading email summary TTS model: {self.model_name}")
        
        # Try the primary model and fallbacks
        models_to_try = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
        
        for model_name in models_to_try:
            try:
                logger.info(f"Attempting to load model: {model_name}")
                
                # Load the TTS pipeline with professional settings
                self.model = pipeline(
                    "text-to-speech",
                    model=model_name,
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                    device=0 if torch.cuda.is_available() else -1,
                    # Suppress warnings for Bark model
                    trust_remote_code=True if "bark" in model_name.lower() else False
                )
                
                # Update the model name to the one that worked
                self.model_name = model_name
                
                # Use professional speaker for business emails
                if "speecht5" in model_name.lower():
                    # SpeechT5 doesn't have speaker_embeddings attribute in newer versions
                    # We'll use the default speaker
                    self.default_speaker = None  # Use default speaker
                    
                logger.info(f"✅ Email summary TTS model loaded successfully: {model_name}")
                return
                
            except Exception as e:
                logger.warning(f"Failed to load model {model_name}: {e}")
                continue
        
        # If all models failed
        raise Exception(f"Failed to load any TTS model. Tried: {models_to_try}")
    
    async def generate_summary_speech(
        self, 
        summary_text: str,
        email_id: str,
        summary_hash: str,
        language: str = "en"
    ) -> bytes:
        """Generate speech specifically for email summaries."""
        
        if not summary_text.strip():
            raise ValueError("Summary text cannot be empty")
            
        # Check cache first using email ID and summary hash
        cache_key = self._generate_summary_cache_key(email_id, summary_hash)
        cached_audio = await self._get_cached_audio(cache_key)
        if cached_audio:
            logger.info(f"Using cached audio for email {email_id}")
            return cached_audio
            
        # Ensure model is loaded
        await self.initialize_model()
        
        # Preprocess summary text for better TTS
        processed_text = self._preprocess_summary_text(summary_text)
        
        logger.info(f"Generating speech for email summary (len={len(processed_text)})")
        
        try:
            # Suppress warnings during model inference
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Generate audio with professional settings
                # Handle different TTS model APIs
                if "bark" in self.model_name.lower():
                    # Bark model
                    audio_output = self.model(processed_text)
                elif "fastspeech2" in self.model_name.lower():
                    # FastSpeech2 model
                    audio_output = self.model(processed_text)
                elif "speecht5" in self.model_name.lower():
                    # SpeechT5 requires speaker embeddings - skip for now
                    raise Exception("SpeechT5 requires speaker embeddings. Using fallback model.")
                else:
                    # Generic TTS model
                    audio_output = self.model(processed_text)
            
            # Apply professional tone adjustments
            if isinstance(audio_output, dict) and "audio" in audio_output:
                audio_array = audio_output["audio"]
                sample_rate = audio_output.get("sampling_rate", 22050)
            elif isinstance(audio_output, dict) and "array" in audio_output:
                # Bark model returns audio in "array" key
                audio_array = audio_output["array"]
                sample_rate = audio_output.get("sampling_rate", 24000)  # Bark uses 24kHz
            else:
                # Handle different output formats
                audio_array = audio_output
                sample_rate = 24000  # Default for Bark
            
            audio_array = self._apply_professional_tone(audio_array)
            
            # Convert to bytes
            audio_bytes = self._audio_to_bytes(audio_array, sample_rate)
            
            # Cache the result
            await self._cache_audio(cache_key, audio_bytes)
            
            logger.info(f"✅ Summary speech generated for email {email_id}")
            return audio_bytes
            
        except Exception as e:
            logger.error(f"❌ Summary speech generation failed: {e}")
            raise
    
    def _preprocess_summary_text(self, text: str) -> str:
        """Preprocess summary text for better TTS reading."""
        # Handle bullet points
        text = text.replace("•", "bullet point")
        text = text.replace("-", "dash")
        
        # Handle email addresses
        import re
        text = re.sub(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', 
                     lambda m: m.group(1).replace('@', ' at ').replace('.', ' dot '), text)
        
        # Handle URLs
        text = re.sub(r'https?://[^\s]+', 'link', text)
        
        # Handle dates
        text = re.sub(r'(\d{1,2})/(\d{1,2})/(\d{4})', r'\1 slash \2 slash \3', text)
        
        # Add pauses for better comprehension
        text = text.replace('.', '. ')
        text = text.replace(',', ', ')
        
        return text
    
    def _apply_professional_tone(self, audio_array):
        """Apply professional tone adjustments to audio."""
        # Slightly slow down the audio for better comprehension
        if TORCHAUDIO_AVAILABLE and hasattr(torchaudio, 'functional'):
            try:
                # Apply time stretching for professional pace
                audio_tensor = torch.from_numpy(audio_array)
                stretched = torchaudio.functional.time_stretch(
                    audio_tensor, 
                    orig_freq=22050, 
                    factor=self.slow_down_factor
                )
                return stretched.numpy()
            except Exception as e:
                logger.warning(f"Failed to apply time stretching: {e}")
                return audio_array
        else:
            logger.info("Skipping professional tone adjustments (torchaudio not available)")
            return audio_array
    
    def _generate_summary_cache_key(self, email_id: str, summary_hash: str) -> str:
        """Generate cache key for email summary audio."""
        content = f"{email_id}|{summary_hash}|{self.model_name}|professional"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def _get_cached_audio(self, cache_key: str) -> Optional[bytes]:
        """Retrieve cached audio if it exists."""
        cache_file = self.cache_dir / f"{cache_key}.wav"
        if cache_file.exists():
            return cache_file.read_bytes()
        return None
    
    async def _cache_audio(self, cache_key: str, audio_bytes: bytes):
        """Cache generated audio."""
        cache_file = self.cache_dir / f"{cache_key}.wav"
        cache_file.write_bytes(audio_bytes)
    
    def _audio_to_bytes(self, audio_array, sample_rate: int) -> bytes:
        """Convert audio array to WAV bytes."""
        import numpy as np
        
        # Handle different audio array formats
        if isinstance(audio_array, np.ndarray):
            # If audio has shape (1, samples), squeeze it to (samples,)
            if audio_array.ndim == 2 and audio_array.shape[0] == 1:
                audio_array = audio_array.squeeze(0)
            # Ensure it's float32
            if audio_array.dtype != np.float32:
                audio_array = audio_array.astype(np.float32)
        
        buffer = io.BytesIO()
        sf.write(buffer, audio_array, sample_rate, format='WAV')
        return buffer.getvalue()
    
    async def get_summary_duration_estimate(self, summary_text: str) -> float:
        """Estimate duration of summary speech in seconds."""
        # Rough estimate: ~150 words per minute for professional speech
        word_count = len(summary_text.split())
        estimated_minutes = word_count / 150
        return estimated_minutes * 60 * self.slow_down_factor
