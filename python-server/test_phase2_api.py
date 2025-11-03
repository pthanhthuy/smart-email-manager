#!/usr/bin/env python3
"""
Phase 2 Test Script for Email Summary TTS API.
Tests the FastAPI endpoints for TTS functionality.
"""

import asyncio
import httpx
import json
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.services.summary_tts import EmailSummaryTTSService
from app.core.config import get_settings


async def test_tts_api_endpoints():
    """Test the TTS API endpoints."""
    print("🧪 Testing Email Summary TTS API Endpoints - Phase 2...")
    
    base_url = "http://localhost:3000"
    
    async with httpx.AsyncClient() as client:
        try:
            # Test 1: Health Check
            print("\n--- Test 1: Health Check ---")
            response = await client.get(f"{base_url}/api/summary-tts/health")
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ Health check passed: {health_data['status']}")
                print(f"   Model: {health_data.get('model', 'N/A')}")
                print(f"   Professional mode: {health_data.get('professional_mode', 'N/A')}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
            
            # Test 2: Get Available Models
            print("\n--- Test 2: Available Models ---")
            response = await client.get(f"{base_url}/api/summary-tts/models")
            if response.status_code == 200:
                models_data = response.json()
                print(f"✅ Models endpoint working")
                print(f"   Current model: {models_data.get('current_model', 'N/A')}")
                print(f"   Fallback models: {len(models_data.get('fallback_models', []))}")
            else:
                print(f"❌ Models endpoint failed: {response.status_code}")
            
            # Test 3: Generate Speech from Text
            print("\n--- Test 3: Generate Speech from Text ---")
            test_text = "This is a test email summary about project updates and meeting schedules."
            response = await client.post(
                f"{base_url}/api/summary-tts/generate-text",
                params={"text": test_text, "language": "en"}
            )
            if response.status_code == 200:
                audio_size = len(response.content)
                duration = response.headers.get('X-Duration', 'N/A')
                print(f"✅ Text-to-speech generation successful")
                print(f"   Audio size: {audio_size} bytes")
                print(f"   Duration: {duration} seconds")
                
                # Save audio file for testing
                with open("test_speech.wav", "wb") as f:
                    f.write(response.content)
                print(f"   Saved audio to: test_speech.wav")
            else:
                print(f"❌ Text-to-speech generation failed: {response.status_code}")
                print(f"   Error: {response.text}")
            
            # Test 4: Generate Speech for Email ID
            print("\n--- Test 4: Generate Speech for Email ID ---")
            test_email_id = "test_email_123"
            response = await client.post(
                f"{base_url}/api/summary-tts/generate/{test_email_id}",
                params={"language": "en"}
            )
            if response.status_code == 200:
                audio_size = len(response.content)
                duration = response.headers.get('X-Duration', 'N/A')
                email_id = response.headers.get('X-Email-ID', 'N/A')
                print(f"✅ Email summary speech generation successful")
                print(f"   Email ID: {email_id}")
                print(f"   Audio size: {audio_size} bytes")
                print(f"   Duration: {duration} seconds")
                
                # Save audio file for testing
                with open(f"test_email_{test_email_id}.wav", "wb") as f:
                    f.write(response.content)
                print(f"   Saved audio to: test_email_{test_email_id}.wav")
            else:
                print(f"❌ Email summary speech generation failed: {response.status_code}")
                print(f"   Error: {response.text}")
            
            # Test 5: Get Summary Info
            print("\n--- Test 5: Get Summary Info ---")
            response = await client.get(f"{base_url}/api/summary-tts/email/{test_email_id}/summary-info")
            if response.status_code == 200:
                summary_info = response.json()
                print(f"✅ Summary info retrieved successfully")
                print(f"   Email ID: {summary_info.get('email_id', 'N/A')}")
                print(f"   Word count: {summary_info.get('word_count', 'N/A')}")
                print(f"   Duration: {summary_info.get('estimated_duration_seconds', 'N/A')}s")
                print(f"   Has cache: {summary_info.get('has_audio_cache', 'N/A')}")
            else:
                print(f"❌ Summary info retrieval failed: {response.status_code}")
                print(f"   Error: {response.text}")
            
            print(f"\n🎉 All Phase 2 API tests completed!")
            return True
            
        except httpx.ConnectError:
            print("❌ Cannot connect to server. Make sure the FastAPI server is running on localhost:3000")
            print("   Start the server with: uvicorn app.main:app --host 0.0.0.0 --port 3000")
            return False
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            return False


async def test_tts_service_directly():
    """Test the TTS service directly (without API)."""
    print("\n🔧 Testing TTS Service Directly...")
    
    try:
        # Initialize the service
        settings = get_settings()
        service = EmailSummaryTTSService(settings)
        
        # Test service initialization
        await service.initialize_model()
        print(f"✅ TTS service initialized: {service.model_name}")
        
        # Test speech generation
        test_text = "This is a direct test of the TTS service for email summaries."
        test_email_id = "direct_test_001"
        summary_hash = "test_hash_123"
        
        audio_bytes = await service.generate_summary_speech(
            summary_text=test_text,
            email_id=test_email_id,
            summary_hash=summary_hash,
            language="en"
        )
        
        print(f"✅ Direct speech generation successful: {len(audio_bytes)} bytes")
        
        # Save audio file
        with open("test_direct_speech.wav", "wb") as f:
            f.write(audio_bytes)
        print(f"   Saved audio to: test_direct_speech.wav")
        
        return True
        
    except Exception as e:
        print(f"❌ Direct TTS service test failed: {e}")
        return False


async def start_test_server():
    """Start the FastAPI server for testing."""
    import subprocess
    import time
    
    print("🚀 Starting FastAPI server for testing...")
    
    # Start server in background
    process = subprocess.Popen([
        "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"
    ], cwd=Path(__file__).parent)
    
    # Wait for server to start
    print("⏳ Waiting for server to start...")
    await asyncio.sleep(5)
    
    return process


if __name__ == "__main__":
    print("🚀 Starting Phase 2 Email Summary TTS API Tests")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not Path("app").exists():
        print("❌ Please run this script from the python-server directory")
        sys.exit(1)
    
    async def run_tests():
        # Test TTS service directly first
        direct_success = await test_tts_service_directly()
        
        if not direct_success:
            print("❌ Direct TTS service test failed. Check dependencies.")
            return False
        
        # Test API endpoints
        api_success = await test_tts_api_endpoints()
        
        if not api_success:
            print("\n💡 To test API endpoints:")
            print("   1. Start the server: uvicorn app.main:app --host 0.0.0.0 --port 3000")
            print("   2. Run this test again")
            return False
        
        return True
    
    # Run tests
    success = asyncio.run(run_tests())
    
    if success:
        print("\n🎉 Phase 2 tests completed successfully!")
        print("📁 Generated test audio files:")
        print("   - test_speech.wav (text-to-speech)")
        print("   - test_email_test_email_123.wav (email summary)")
        print("   - test_direct_speech.wav (direct service)")
    else:
        print("\n❌ Some tests failed. Check the output above.")
    
    sys.exit(0 if success else 1)
