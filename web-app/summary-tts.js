/**
 * Email Summary Text-to-Speech client for Hugging Face TTS.
 * Specialized for reading AI-generated email summaries.
 */

class EmailSummaryTTSClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.audioContext = null;
        this.isPlaying = false;
        this.currentEmailId = null;
        this.currentSource = null;
    }

    async initialize() {
        // Initialize Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🔊 Email Summary TTS Client initialized');
    }

    async generateSummarySpeech(emailId, options = {}) {
        const {
            language = 'en',
            summaryText = null,
            emailData = null
        } = options;

        try {
            console.log(`🎵 Generating speech for email: ${emailId}`);
            
            // Prepare request body if summary text or email data is provided
            const requestBody = {};
            if (summaryText) {
                requestBody.summary_text = summaryText;
            } else if (emailData) {
                requestBody.email_data = emailData;
            }
            
            const response = await fetch(`${this.baseUrl}/summary-tts/generate/${emailId}?language=${language}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined
            });

            if (!response.ok) {
                throw new Error(`Summary TTS generation failed: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const duration = response.headers.get('X-Duration');
            
            console.log(`✅ Speech generated: ${audioBlob.size} bytes, ${duration}s duration`);
            
            return {
                audioBlob,
                duration: parseFloat(duration),
                emailId: response.headers.get('X-Email-ID')
            };

        } catch (error) {
            console.error('❌ Summary TTS generation error:', error);
            throw error;
        }
    }

    async generateSpeechFromText(text, options = {}) {
        const {
            language = 'en'
        } = options;

        try {
            console.log(`🎵 Generating speech from text: ${text.substring(0, 50)}...`);
            
            const response = await fetch(`${this.baseUrl}/summary-tts/generate-text?text=${encodeURIComponent(text)}&language=${language}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Text TTS generation failed: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const duration = response.headers.get('X-Duration');
            
            console.log(`✅ Speech generated: ${audioBlob.size} bytes, ${duration}s duration`);
            
            return {
                audioBlob,
                duration: parseFloat(duration),
                textLength: parseInt(response.headers.get('X-Text-Length'))
            };

        } catch (error) {
            console.error('❌ Text TTS generation error:', error);
            throw error;
        }
    }

    async playSummarySpeech(audioBlob, emailId) {
        if (this.isPlaying) {
            await this.stopSummarySpeech();
        }

        try {
            console.log(`▶️ Playing speech for email: ${emailId}`);
            
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            this.currentSource = source;
            this.currentEmailId = emailId;
            this.isPlaying = true;
            
            source.onended = () => {
                this.isPlaying = false;
                this.currentEmailId = null;
                console.log(`⏹️ Finished playing speech for email: ${emailId}`);
            };
            
            source.start();
            
            return new Promise((resolve) => {
                source.onended = () => {
                    this.isPlaying = false;
                    this.currentEmailId = null;
                    resolve();
                };
            });

        } catch (error) {
            console.error('❌ Summary audio playback error:', error);
            throw error;
        }
    }

    async stopSummarySpeech() {
        if (this.currentSource && this.isPlaying) {
            console.log(`⏹️ Stopping speech for email: ${this.currentEmailId}`);
            this.currentSource.stop();
            this.isPlaying = false;
            this.currentEmailId = null;
        }
    }

    async getSummaryInfo(emailId) {
        try {
            const response = await fetch(`${this.baseUrl}/summary-tts/email/${emailId}/summary-info`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Failed to get summary info:', error);
            return null;
        }
    }

    async speakEmailSummary(emailId, options = {}) {
        const summaryData = await this.generateSummarySpeech(emailId, options);
        return await this.playSummarySpeech(summaryData.audioBlob, emailId);
    }

    async speakText(text, options = {}) {
        const speechData = await this.generateSpeechFromText(text, options);
        return await this.playSummarySpeech(speechData.audioBlob, `text_${Date.now()}`);
    }

    // UI Integration methods
    createSummaryPlayButton(emailId, containerElement) {
        const button = document.createElement('button');
        button.className = 'summary-play-btn';
        button.innerHTML = '🔊 Play Summary';
        button.style.cssText = `
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 4px;
        `;
        
        button.onclick = async () => {
            try {
                button.disabled = true;
                button.innerHTML = '⏳ Generating...';
                
                await this.speakEmailSummary(emailId);
                
                button.innerHTML = '🔊 Play Summary';
            } catch (error) {
                console.error('❌ Playback failed:', error);
                button.innerHTML = '❌ Error';
                setTimeout(() => {
                    button.innerHTML = '🔊 Play Summary';
                }, 2000);
            } finally {
                button.disabled = false;
            }
        };
        
        // Add duration info
        this.getSummaryInfo(emailId).then(info => {
            if (info) {
                const durationSpan = document.createElement('span');
                durationSpan.className = 'summary-duration';
                durationSpan.textContent = ` (~${Math.round(info.estimated_duration_seconds)}s)`;
                durationSpan.style.cssText = 'font-size: 12px; color: #666; margin-left: 8px;';
                button.appendChild(durationSpan);
            }
        });
        
        containerElement.appendChild(button);
        return button;
    }

    createTextPlayButton(text, containerElement) {
        const button = document.createElement('button');
        button.className = 'text-play-btn';
        button.innerHTML = '🔊 Play Text';
        button.style.cssText = `
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 4px;
        `;
        
        button.onclick = async () => {
            try {
                button.disabled = true;
                button.innerHTML = '⏳ Generating...';
                
                await this.speakText(text);
                
                button.innerHTML = '🔊 Play Text';
            } catch (error) {
                console.error('❌ Playback failed:', error);
                button.innerHTML = '❌ Error';
                setTimeout(() => {
                    button.innerHTML = '🔊 Play Text';
                }, 2000);
            } finally {
                button.disabled = false;
            }
        };
        
        containerElement.appendChild(button);
        return button;
    }

    createSummaryProgressBar(emailId, containerElement) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'summary-progress-container';
        progressContainer.style.cssText = `
            width: 100%;
            height: 4px;
            background: #e9ecef;
            border-radius: 2px;
            margin: 8px 0;
            display: none;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'summary-progress-bar';
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: #007bff;
            border-radius: 2px;
            transition: width 0.1s ease;
        `;
        
        progressContainer.appendChild(progressBar);
        containerElement.appendChild(progressContainer);
        
        return { container: progressContainer, bar: progressBar };
    }

    async checkServiceHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/summary-tts/health`);
            const data = await response.json();
            console.log('🏥 TTS Service Health:', data);
            return data;
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }

    async getAvailableModels() {
        try {
            const response = await fetch(`${this.baseUrl}/summary-tts/models`);
            const data = await response.json();
            console.log('🤖 Available TTS Models:', data);
            return data;
        } catch (error) {
            console.error('❌ Failed to get models:', error);
            return null;
        }
    }
}

// Usage examples and helper functions
const summaryTTSClient = new EmailSummaryTTSClient();

// Initialize and add play buttons to email list
async function initializeEmailSummaryTTS() {
    await summaryTTSClient.initialize();
    
    // Check service health
    const health = await summaryTTSClient.checkServiceHealth();
    if (health.status !== 'healthy') {
        console.warn('⚠️ TTS service is not healthy:', health);
        return false;
    }
    
    // Get available models
    const models = await summaryTTSClient.getAvailableModels();
    console.log('🎯 Using TTS model:', models?.current_model);
    
    return true;
}

// Add play buttons to email list
function addSummaryPlayButtons() {
    document.querySelectorAll('.email-item').forEach(emailItem => {
        const emailId = emailItem.dataset.emailId;
        const summaryContainer = emailItem.querySelector('.email-summary');
        
        if (summaryContainer && !summaryContainer.querySelector('.summary-play-btn')) {
            summaryTTSClient.createSummaryPlayButton(emailId, summaryContainer);
        }
    });
}

// Example: Add play button to any text element
function addTextPlayButton(textElement) {
    const container = textElement.parentElement;
    if (!container.querySelector('.text-play-btn')) {
        summaryTTSClient.createTextPlayButton(textElement.textContent, container);
    }
}

// Example: Read email summary
async function readEmailSummary(emailId) {
    await summaryTTSClient.initialize();
    
    try {
        // Get summary info first
        const summaryInfo = await summaryTTSClient.getSummaryInfo(emailId);
        if (!summaryInfo) {
            console.error('❌ No summary available for email:', emailId);
            return;
        }
        
        console.log(`📖 Reading summary for email ${emailId} (${summaryInfo.word_count} words, ~${Math.round(summaryInfo.estimated_duration_seconds)}s)`);
        
        // Play the summary
        await summaryTTSClient.speakEmailSummary(emailId);
        
    } catch (error) {
        console.error('❌ Failed to read email summary:', error);
    }
}

// Export for use in other scripts
window.EmailSummaryTTSClient = EmailSummaryTTSClient;
window.summaryTTSClient = summaryTTSClient;
window.initializeEmailSummaryTTS = initializeEmailSummaryTTS;
window.addSummaryPlayButtons = addSummaryPlayButtons;
window.addTextPlayButton = addTextPlayButton;
window.readEmailSummary = readEmailSummary;
