#!/usr/bin/env python3
"""
Test script to verify Hugging Face TTS integration with the UI
"""

import asyncio
import httpx
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

BASE_URL = "http://localhost:3000"

async def test_huggingface_tts_integration():
    """Test the Hugging Face TTS integration with the UI."""
    print("🧪 Testing Hugging Face TTS Integration with UI")
    print("=" * 50)
    
    client = httpx.AsyncClient(base_url=BASE_URL)
    
    try:
        # Test 1: Check if TTS service is running
        print("\n1. Testing TTS Service Health...")
        try:
            response = await client.get("/summary-tts/health")
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ TTS Service is healthy: {health_data.get('status', 'unknown')}")
                print(f"   Model: {health_data.get('model', 'unknown')}")
            else:
                print(f"❌ TTS Service health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ TTS Service health check failed: {e}")
            return False
        
        # Test 2: Test TTS generation
        print("\n2. Testing TTS Generation...")
        try:
            test_summary = "This is a test summary for the Hugging Face TTS integration. The system should be able to convert this text to speech."
            test_email_id = "ui_integration_test_001"
            
            response = await client.post(
                f"/summary-tts/generate/{test_email_id}",
                json={"summary": test_summary}
            )
            
            if response.status_code == 200:
                audio_bytes = response.content
                print(f"✅ TTS generation successful: {len(audio_bytes)} bytes")
                
                # Save test audio
                with open("ui_integration_test.wav", "wb") as f:
                    f.write(audio_bytes)
                print("   Saved test audio to: ui_integration_test.wav")
            else:
                print(f"❌ TTS generation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ TTS generation failed: {e}")
            return False
        
        # Test 3: Test email summarization endpoint
        print("\n3. Testing Email Summarization...")
        try:
            mock_email = {
                "id": "test_email_001",
                "subject": "Test Email Subject",
                "from": "test@example.com",
                "content": "This is a test email content for summarization testing.",
                "date": "2024-01-01T00:00:00Z"
            }
            
            response = await client.post(
                "/summarize-email",
                json={
                    "emailId": mock_email["id"],
                    "emailData": mock_email
                }
            )
            
            if response.status_code == 200:
                summary_data = response.json()
                print(f"✅ Email summarization successful")
                print(f"   Summary: {summary_data.get('summary', 'No summary')[:100]}...")
            else:
                print(f"❌ Email summarization failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Email summarization failed: {e}")
            return False
        
        # Test 4: Test search functionality
        print("\n4. Testing Search Functionality...")
        try:
            response = await client.post(
                "/search",
                json={"query": "test search query"}
            )
            
            if response.status_code == 200:
                search_data = response.json()
                print(f"✅ Search functionality working")
                print(f"   Found {len(search_data.get('results', []))} results")
            else:
                print(f"❌ Search functionality failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Search functionality failed: {e}")
            return False
        
        print("\n🎉 All tests passed! Hugging Face TTS integration is working correctly.")
        print("\n📋 Integration Summary:")
        print("   ✅ TTS Service is running and healthy")
        print("   ✅ TTS generation is working")
        print("   ✅ Email summarization is working")
        print("   ✅ Search functionality is working")
        print("\n🚀 Ready to use the UI with Hugging Face TTS!")
        
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False
    finally:
        await client.aclose()

async def main():
    """Run the integration test."""
    print("🚀 Starting Hugging Face TTS UI Integration Test")
    print("=" * 60)
    
    success = await test_huggingface_tts_integration()
    
    if success:
        print("\n✅ Integration test completed successfully!")
        print("\n📝 Next Steps:")
        print("   1. Start the server: cd python-server && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload")
        print("   2. Open the UI: http://localhost:3000")
        print("   3. Click 'Summarize' on any email")
        print("   4. Click '🔊 Read Summary' to hear the Hugging Face TTS")
        print("   5. Test the TTS with the 'Test Hugging Face TTS' button")
    else:
        print("\n❌ Integration test failed. Please check the server and try again.")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

