// Debug script to check if Hugging Face TTS is working
console.log('🔍 Debug: Checking Hugging Face TTS Integration...');

// Check if the HuggingFaceTTSClient class exists
if (typeof HuggingFaceTTSClient !== 'undefined') {
    console.log('✅ HuggingFaceTTSClient class found');
} else {
    console.log('❌ HuggingFaceTTSClient class NOT found');
}

// Check if SmartEmailManager has hfTTS property
if (window.smartEmailManager && window.smartEmailManager.hfTTS) {
    console.log('✅ SmartEmailManager has hfTTS property');
    console.log('   hfTTS type:', typeof window.smartEmailManager.hfTTS);
} else {
    console.log('❌ SmartEmailManager does not have hfTTS property');
    console.log('   SmartEmailManager exists:', !!window.smartEmailManager);
}

// Test TTS service directly
async function testTTSServiceDirectly() {
    console.log('🧪 Testing TTS service directly...');
    try {
        const response = await fetch('http://localhost:3000/summary-tts/health');
        if (response.ok) {
            const data = await response.json();
            console.log('✅ TTS Service is healthy:', data);
            return true;
        } else {
            console.log('❌ TTS Service error:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ TTS Service connection failed:', error);
        return false;
    }
}

// Test audio generation directly
async function testAudioGenerationDirectly() {
    console.log('🧪 Testing audio generation directly...');
    try {
        const testText = "This is a direct test of the Hugging Face TTS system.";
        const testEmailId = "debug_test_001";
        
        const response = await fetch(`http://localhost:3000/summary-tts/generate/${testEmailId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ summary: testText })
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            console.log('✅ Audio generation successful:', audioBlob.size, 'bytes');
            return true;
        } else {
            const errorData = await response.json();
            console.log('❌ Audio generation failed:', errorData);
            return false;
        }
    } catch (error) {
        console.log('❌ Audio generation error:', error);
        return false;
    }
}

// Run tests
setTimeout(async () => {
    console.log('🚀 Running debug tests...');
    
    const ttsServiceOk = await testTTSServiceDirectly();
    const audioGenOk = await testAudioGenerationDirectly();
    
    if (ttsServiceOk && audioGenOk) {
        console.log('🎉 All tests passed! Hugging Face TTS should be working.');
    } else {
        console.log('❌ Some tests failed. Check the issues above.');
    }
}, 2000);

// Override the readSummary method to add debug logging
if (window.smartEmailManager) {
    const originalReadSummary = window.smartEmailManager.readSummary;
    window.smartEmailManager.readSummary = async function(emailId) {
        console.log('🔍 Debug: readSummary called for email:', emailId);
        console.log('🔍 Debug: currentSummary:', this.currentSummary);
        console.log('🔍 Debug: hfTTS exists:', !!this.hfTTS);
        
        if (this.hfTTS) {
            console.log('🔍 Debug: Using Hugging Face TTS');
            try {
                await this.hfTTS.playSummarySpeech(emailId, this.currentSummary, this.hfTTS.getCurrentVoiceProfile());
                this.showMessage('🎵 Playing summary with Hugging Face TTS', 'success');
                console.log('✅ Hugging Face TTS successful');
            } catch (error) {
                console.log('❌ Hugging Face TTS failed:', error);
                this.showMessage('Hugging Face TTS failed, falling back to Web Speech API', 'error');
                this.readSummaryWithWebSpeech(emailId);
            }
        } else {
            console.log('❌ hfTTS not available, using Web Speech API fallback');
            this.readSummaryWithWebSpeech(emailId);
        }
    };
    console.log('🔧 Debug: readSummary method overridden with logging');
}

