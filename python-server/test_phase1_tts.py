#!/usr/bin/env python3
"""
Phase 1 Test Script for Email Summary TTS Implementation.
Tests basic functionality of the EmailSummaryTTSService.
"""

import asyncio
import os
import sys
import hashlib
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

# Check for torch availability
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("❌ PyTorch not available. Please install: pip install torch")

from app.services.summary_tts import EmailSummaryTTSService
from app.core.config import get_settings


async def test_email_summary_tts():
    """Test the Email Summary TTS service."""
    print("🧪 Testing Email Summary TTS Service - Phase 1...")
    
    if not TORCH_AVAILABLE:
        print("❌ PyTorch not available. Cannot run Hugging Face TTS tests.")
        return False
    
    try:
        # Initialize the service
        settings = get_settings()
        service = EmailSummaryTTSService(settings)
        
        # Test email summaries
        test_summaries = [
            {
                "email_id": "test_email_001",
                "summary": "Meeting scheduled for tomorrow at 3 PM with the marketing team. Please prepare the quarterly report and budget analysis.",
                "description": "Business meeting reminder"
            },
            {
                "email_id": "test_email_002", 
                "summary": "Project deadline extended to next Friday. Contact john.doe@company.com for more details.",
                "description": "Project update with email address"
            },
            {
                "email_id": "test_email_003",
                "summary": "Budget approval required for Q4 expenses. Total amount: $50,000. Please review by 12/15/2024.",
                "description": "Budget request with date"
            }
        ]
        
        print(f"\n📝 Testing {len(test_summaries)} email summaries...")
        
        for i, test_case in enumerate(test_summaries, 1):
            print(f"\n--- Test {i}: {test_case['description']} ---")
            
            # Generate summary hash
            summary_hash = hashlib.md5(test_case['summary'].encode()).hexdigest()
            
            # Test text preprocessing
            processed_text = service._preprocess_summary_text(test_case['summary'])
            print(f"Original: {test_case['summary']}")
            print(f"Processed: {processed_text}")
            
            # Test duration estimation
            duration = await service.get_summary_duration_estimate(test_case['summary'])
            print(f"Estimated duration: {duration:.1f} seconds")
            
            # Test speech generation
            print("Generating speech...")
            audio_bytes = await service.generate_summary_speech(
                summary_text=test_case['summary'],
                email_id=test_case['email_id'],
                summary_hash=summary_hash,
                language="en"
            )
            
            print(f"✅ Audio generated: {len(audio_bytes)} bytes")
            
            # Test caching
            cached_audio = await service._get_cached_audio(
                service._generate_summary_cache_key(test_case['email_id'], summary_hash)
            )
            if cached_audio:
                print("✅ Audio cached successfully")
            else:
                print("❌ Audio caching failed")
        
        # Test model initialization
        print(f"\n🔧 Testing model initialization...")
        await service.initialize_model()
        print(f"✅ Model loaded: {service.model_name}")
        print(f"✅ Professional tone: {service.professional_tone}")
        print(f"✅ Slow down factor: {service.slow_down_factor}")
        
        print(f"\n🎉 All Phase 1 tests passed! Email Summary TTS is working correctly.")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("\n💡 Make sure to:")
        print("   1. Install dependencies: pip install -r requirements.txt")
        print("   2. Check your internet connection for model download")
        print("   3. Verify sufficient disk space for model cache")
        return False


async def test_model_loading():
    """Test just the model loading functionality."""
    print("\n🔧 Testing Hugging Face model loading...")
    
    try:
        service = EmailSummaryTTSService()
        await service.initialize_model()
        
        print(f"✅ Model loaded successfully: {service.model_name}")
        print(f"✅ Device: {'GPU' if torch.cuda.is_available() else 'CPU'}")
        print(f"✅ Cache directory: {service.cache_dir}")
        
        return True
        
    except Exception as e:
        print(f"❌ Model loading failed: {e}")
        return False


if __name__ == "__main__":
    print("🚀 Starting Phase 1 Email Summary TTS Tests")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path("app").exists():
        print("❌ Please run this script from the python-server directory")
        sys.exit(1)
    
    # Run tests
    success = asyncio.run(test_email_summary_tts())
    
    if not success:
        print("\n🔧 Running basic model loading test...")
        model_success = asyncio.run(test_model_loading())
        if not model_success:
            print("\n❌ Basic model loading also failed. Check dependencies.")
    
    sys.exit(0 if success else 1)
