"""
Simplified Email Summary Text-to-Speech service.
Uses basic TTS without complex model dependencies.
"""

import os
import io
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List
import soundfile as sf
import numpy as np
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SimpleEmailSummaryTTSService:
    """Simplified TTS service for email summary reading."""
    
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.cache_dir = Path(self.settings.tts_cache_dir or "./summary_tts_cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        # Email-specific configuration
        self.professional_tone = True
        self.slow_down_factor = 0.9  # Slightly slower for better comprehension
        
        # Simple TTS using system TTS (platform-dependent)
        self.use_system_tts = True
        
    async def initialize_model(self):
        """Initialize the TTS model (simplified version)."""
        logger.info("Initializing simplified TTS service")
        
        # Check if we can use system TTS
        try:
            import subprocess
            # Test if system TTS is available
            if os.name == 'nt':  # Windows
                subprocess.run(['powershell', '-Command', 'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("test")'], 
                             capture_output=True, timeout=5)
            elif os.name == 'posix':  # macOS/Linux
                subprocess.run(['say', 'test'], capture_output=True, timeout=5)
            
            logger.info("✅ System TTS available")
            self.use_system_tts = True
            
        except Exception as e:
            logger.warning(f"System TTS not available: {e}")
            self.use_system_tts = False
            
        logger.info("✅ Simplified TTS service initialized")
    
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
            if self.use_system_tts:
                # Use system TTS
                audio_bytes = await self._generate_system_tts(processed_text)
            else:
                # Generate a simple tone as fallback
                audio_bytes = await self._generate_fallback_audio(processed_text)
            
            # Cache the result
            await self._cache_audio(cache_key, audio_bytes)
            
            logger.info(f"✅ Summary speech generated for email {email_id}")
            return audio_bytes
            
        except Exception as e:
            logger.error(f"❌ Summary speech generation failed: {e}")
            raise
    
    async def _generate_system_tts(self, text: str) -> bytes:
        """Generate audio using system TTS."""
        import subprocess
        import tempfile
        
        # Create temporary file for audio output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            if os.name == 'nt':  # Windows
                # Use PowerShell with System.Speech
                ps_script = f'''
                Add-Type -AssemblyName System.Speech
                $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                $synth.Rate = -2
                $synth.SetOutputToWaveFile("{temp_path}")
                $synth.Speak("{text}")
                $synth.Dispose()
                '''
                subprocess.run(['powershell', '-Command', ps_script], 
                             check=True, capture_output=True)
                
            elif os.name == 'posix':  # macOS/Linux
                # Use 'say' command on macOS or 'espeak' on Linux
                if os.uname().sysname == 'Darwin':  # macOS
                    subprocess.run(['say', '-o', temp_path, text], 
                                 check=True, capture_output=True)
                else:  # Linux
                    subprocess.run(['espeak', '-w', temp_path, text], 
                                 check=True, capture_output=True)
            
            # Read the generated audio file
            with open(temp_path, 'rb') as f:
                audio_bytes = f.read()
            
            return audio_bytes
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    async def _generate_fallback_audio(self, text: str) -> bytes:
        """Generate a simple fallback audio (beep pattern)."""
        # Generate a simple audio pattern based on text length
        duration = len(text) * 0.1  # 0.1 seconds per character
        sample_rate = 22050
        samples = int(duration * sample_rate)
        
        # Create a simple tone pattern
        t = np.linspace(0, duration, samples)
        frequency = 440  # A4 note
        audio = np.sin(2 * np.pi * frequency * t) * 0.3
        
        # Convert to bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, sample_rate, format='WAV')
        return buffer.getvalue()
    
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
    
    def _generate_summary_cache_key(self, email_id: str, summary_hash: str) -> str:
        """Generate cache key for email summary audio."""
        content = f"{email_id}|{summary_hash}|simple_tts|professional"
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
    
    async def get_summary_duration_estimate(self, summary_text: str) -> float:
        """Estimate duration of summary speech in seconds."""
        # Rough estimate: ~150 words per minute for professional speech
        word_count = len(summary_text.split())
        estimated_minutes = word_count / 150
        return estimated_minutes * 60 * self.slow_down_factor
