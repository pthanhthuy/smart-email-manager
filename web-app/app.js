/**
 * Hugging Face TTS Client for Email Summary Reading
 * Replaces Web Speech API with our custom Hugging Face TTS system
 */

class HuggingFaceTTSClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.audioContext = null;
        this.isPlaying = false;
        this.currentEmailId = null;
        this.currentSource = null;
        this.currentSummary = null;
        
        // Voice settings
        this.voiceSettings = {
            voice: 'professional', // professional, casual, urgent, detailed
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            // Initialize Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🔊 Hugging Face TTS Client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize TTS client:', error);
        }
    }

    async generateSpeechFromText(text, emailId, voiceProfile = 'professional') {
        try {
            console.log(`🎵 Generating Hugging Face speech for email: ${emailId}`);

            const response = await fetch(`${this.baseUrl}/summary-tts/generate/${emailId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    summary_text: text
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { detail: errorText };
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioBuffer = await this.audioContext.decodeAudioData(await audioBlob.arrayBuffer());
            const duration = audioBuffer.duration;

            console.log(`✅ Hugging Face speech generated for email ${emailId}. Duration: ${duration.toFixed(2)}s`);
            
            return {
                audioBuffer,
                duration,
                audioBlob
            };
        } catch (error) {
            console.error('❌ Failed to generate Hugging Face speech:', error);
            throw error;
        }
    }

    async playSummarySpeech(emailId, summaryText, voiceProfile = 'professional') {
        if (this.isPlaying) {
            await this.stopSummarySpeech();
        }

        try {
            this.isPlaying = true;
            this.currentEmailId = emailId;
            this.currentSummary = summaryText;

            const speechData = await this.generateSpeechFromText(summaryText, emailId, voiceProfile);
            
            // Create audio source
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = speechData.audioBuffer;
            this.currentSource.connect(this.audioContext.destination);

            // Set up event handlers
            this.currentSource.onended = () => {
                this.isPlaying = false;
                this.currentSource = null;
                console.log(`🎵 Hugging Face speech playback completed for email: ${emailId}`);
                this.updateReadButton(emailId, '🔊 Read Summary', 'read');
            };

            // Start playback
            this.currentSource.start();
            console.log(`🎵 Hugging Face speech playback started for email: ${emailId}`);
            
            this.updateReadButton(emailId, '⏹️ Stop Reading', 'stop');
            
            return {
                duration: speechData.duration,
                success: true
            };
        } catch (error) {
            this.isPlaying = false;
            console.error('❌ Failed to play Hugging Face summary speech:', error);
            this.updateReadButton(emailId, '🔊 Read Summary', 'read');
            throw error;
        }
    }

    async stopSummarySpeech() {
        if (this.currentSource && this.isPlaying) {
            try {
                this.currentSource.stop();
                this.currentSource = null;
                this.isPlaying = false;
                console.log(`🛑 Hugging Face speech playback stopped for email: ${this.currentEmailId}`);
                
                // Update all read buttons
                document.querySelectorAll('.tts-read-btn').forEach(btn => {
                    btn.innerHTML = '🔊 Read Summary';
                });
            } catch (error) {
                console.warn('⚠️ Error stopping Hugging Face speech playback:', error);
            }
        }
    }

    updateReadButton(emailId, text, action) {
        const emailItem = document.querySelector(`[data-email-id="${emailId}"]`)?.closest('.email-item');
        if (!emailItem) return;
        
        const readBtn = emailItem.querySelector('.tts-read-btn');
        if (readBtn) {
            readBtn.innerHTML = text;
            readBtn.setAttribute('data-email-id', emailId);
            
            if (action === 'stop') {
                readBtn.onclick = () => this.stopSummarySpeech();
            } else {
                readBtn.onclick = () => this.playSummarySpeech(emailId, this.currentSummary);
            }
        }
    }

    setVoiceProfile(voiceProfile) {
        this.voiceSettings.voice = voiceProfile;
        console.log(`🎭 Voice profile set to: ${voiceProfile}`);
    }

    getCurrentVoiceProfile() {
        return this.voiceSettings.voice;
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }

    getCurrentEmailId() {
        return this.currentEmailId;
    }
}

// Smart Email Manager - JavaScript Application with Hugging Face TTS Integration

class SmartEmailManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000';
        this.currentTone = 'professional';
        this.selectedEmail = null;
        this.selectedResponse = null;
        this.useRAG = false; // RAG mode toggle
        
        // Initialize Hugging Face TTS client
        this.hfTTS = new HuggingFaceTTSClient(this.apiBaseUrl);
        
        // Legacy TTS state (for fallback)
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.currentSummary = null;
        this.currentEmailId = null;
        this.ttsSettings = {
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            voice: null,
            isPlaying: false,
            isPaused: false
        };
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.testServerConnection();
        this.loadUserStats();
        this.showWelcomeMessage();
    }

    setupEventListeners() {
        // Search functionality
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        searchBtn.addEventListener('click', () => this.performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Tone selector
        const toneButtons = document.querySelectorAll('.tone-btn');
        toneButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                toneButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTone = e.target.dataset.tone;
            });
        });

        // RAG mode toggle
        const ragToggle = document.getElementById('ragModeToggle');
        if (ragToggle) {
            ragToggle.addEventListener('change', (e) => {
                this.useRAG = e.target.checked;
                console.log(`RAG mode: ${this.useRAG ? 'enabled' : 'disabled'}`);
            });
        }

        // Quick instruction buttons
        const quickButtons = document.querySelectorAll('.quick-btn');
        quickButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instruction = e.target.dataset.instruction;
                const instructionInput = document.getElementById('responseInstruction');
                instructionInput.value = instruction;
                instructionInput.focus();
            });
        });

        // Sync button
        const syncBtn = document.getElementById('syncBtn');
        syncBtn.addEventListener('click', () => this.syncEmails());

        // AI Response actions
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveDraft());
        document.getElementById('editResponseBtn').addEventListener('click', () => this.editResponse());
        document.getElementById('generateNewBtn').addEventListener('click', () => this.generateNewResponse());

        // History functionality
        document.getElementById('loadHistoryBtn').addEventListener('click', () => this.loadResponseHistory());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearResponseHistory());

        // Tone analysis functionality
        document.getElementById('analyzeToneBtn').addEventListener('click', () => this.analyzeTone());

        // Keyboard shortcuts for TTS
        document.addEventListener('keydown', (e) => this.handleTTSKeyboardShortcuts(e));

        // TTS test functionality
        document.getElementById('testTTSBtn').addEventListener('click', () => this.testTTS());
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.showMessage('Please enter a search term', 'error');
            return;
        }

        this.showLoading(true, 'Searching emails...');
        this.hideEmptyState();
        this.hideAIResponsePanel();

        try {
            const response = await fetch(`${this.apiBaseUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.displaySearchResults(data.results || []);
            
        } catch (error) {
            console.error('Search error:', error);
            
            // Provide more specific error messages
            let errorMessage = 'Search failed: ';
            if (error.message.includes('Failed to fetch')) {
                errorMessage += 'Cannot connect to server. Please make sure the server is running on port 3000.';
            } else {
                errorMessage += error.message;
            }
            
            this.showMessage(errorMessage, 'error');
            this.showEmptyState();
        } finally {
            this.showLoading(false);
        }
    }

    displaySearchResults(emails) {
        const resultsContainer = document.getElementById('emailResults');
        const resultsCount = document.getElementById('resultsCount');
        const resultsNumber = document.getElementById('resultsNumber');
        
        if (!resultsContainer) {
            console.error('Results container not found!');
            return;
        }
        
        if (emails.length === 0) {
            this.showEmptyState();
            this.hideResultsCount();
            return;
        }

        try {
            // Show results count
            this.showResultsCount(emails.length);
            
            const htmlContent = emails.map(email => this.createEmailItem(email)).join('');
            resultsContainer.innerHTML = htmlContent;
            
            // Add scroll indicator if there are more than 3 emails
            if (emails.length > 3) {
                this.addScrollIndicator();
            }
            
            // Add event listeners to generate response buttons
            document.querySelectorAll('.generate-response-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const emailId = e.target.dataset.emailId;
                    const email = emails.find(e => e.id === emailId);
                    this.generateAIResponse(email);
                });
            });

            // Add event listeners to summarize buttons
            document.querySelectorAll('.summarize-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const emailId = e.target.dataset.emailId;
                    const email = emails.find(e => e.id === emailId);
                    this.summarizeEmail(email);
                });
            });
        } catch (error) {
            console.error('Error displaying results:', error);
            this.showMessage('Error displaying results: ' + error.message, 'error');
        }
    }

    createEmailItem(email) {
        try {
            const date = new Date(email.date).toLocaleDateString();
            const preview = (email.snippet || email.content || '').substring(0, 150) + ((email.snippet || email.content || '').length > 150 ? '...' : '');
            
            return `
                <div class="email-item">
                    <div class="email-header">
                        <div class="email-from">${email.from || 'Unknown'}</div>
                        <div class="email-date">${date}</div>
                    </div>
                    <div class="email-subject">${email.subject || 'No Subject'}</div>
                    <div class="email-preview">${preview}</div>
                    <div class="email-actions">
                        <button class="action-btn btn-primary generate-response-btn" data-email-id="${email.id}">
                            🤖 Generate Response
                        </button>
                        <button class="action-btn btn-info summarize-btn" data-email-id="${email.id}">
                            📝 Summarize
                        </button>
                        <button class="action-btn btn-secondary" onclick="viewFullEmail('${email.id}')">
                            📖 View Full
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating email item:', error);
            return `
                <div class="email-item">
                    <div class="email-header">
                        <div class="email-from">Error displaying email</div>
                        <div class="email-date">Error</div>
                    </div>
                    <div class="email-subject">Error: ${error.message}</div>
                    <div class="email-preview">Failed to display email content</div>
                </div>
            `;
        }
    }

    async generateAIResponse(email) {
        this.selectedEmail = email;
        const useRAG = this.useRAG;
        const loadingMessage = useRAG 
            ? 'Generating AI response with context from similar emails...' 
            : 'Generating AI response...';
        this.showLoading(true, loadingMessage);

        // Get user instruction from the input field
        const instructionInput = document.getElementById('responseInstruction');
        const userInstruction = instructionInput.value.trim() || 'Generate a helpful response';

        try {
            // Choose endpoint based on RAG mode
            const endpoint = useRAG 
                ? `${this.apiBaseUrl}/chains/rag-response` 
                : `${this.apiBaseUrl}/generate-response`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailData: email,
                    userInstruction: userInstruction,
                    options: {
                        tone: this.currentTone,
                        contextEmailsLimit: useRAG ? 3 : undefined // Use context when RAG is enabled
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`AI response generation failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Display response with RAG context info if available
            this.displayAIResponse(data.suggestions || [], data.analysis || {});
            
            // Show RAG context info if used
            if (useRAG && data.metadata && data.metadata.contextEmailsUsed > 0) {
                this.showMessage(
                    `✅ Used ${data.metadata.contextEmailsUsed} similar emails as context for better response quality`,
                    'success',
                    3000
                );
            }
            
            // Clear the instruction field after successful generation
            const instructionInput = document.getElementById('responseInstruction');
            instructionInput.value = '';
            
        } catch (error) {
            console.error('AI response error:', error);
            this.showMessage(`AI response failed: ${error.message}`, 'error');
            
            // Fallback to regular endpoint if RAG fails
            if (useRAG) {
                console.log('RAG failed, falling back to regular response generation');
                this.useRAG = false;
                return this.generateAIResponse(email);
            }
        } finally {
            this.showLoading(false);
        }
    }

    async summarizeEmail(email) {
        try {
            // Show loading state on the specific email card
            this.showEmailSummaryLoading(email.id, true);

            const response = await fetch(`${this.apiBaseUrl}/summarize-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailId: email.id,
                    emailData: email
                })
            });

            if (!response.ok) {
                throw new Error(`Email summarization failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Summary response:', data);
            console.log('Summary text:', data.summary);
            this.displayEmailSummary(email.id, data.summary);
            
        } catch (error) {
            console.error('Email summarization error:', error);
            this.showEmailSummaryError(email.id, `Summarization failed: ${error.message}`);
        } finally {
            this.showEmailSummaryLoading(email.id, false);
        }
    }

    displayAIResponse(suggestions, analysis = {}) {
        const responsePanel = document.getElementById('aiResponsePanel');
        const optionsContainer = document.getElementById('responseOptions');
        
        // Show context info if RAG was used
        let contextInfo = '';
        if (analysis.contextUsed) {
            const contextCount = analysis.contextEmailsCount || 0;
            contextInfo = `<div class="rag-context-info" style="margin-bottom: 10px; padding: 8px; background: #e0f2fe; border-radius: 6px; font-size: 12px; color: #0369a1;">
                🧠 Used ${contextCount} similar emails as context
            </div>`;
        }
        
        optionsContainer.innerHTML = contextInfo + suggestions.map((suggestion, index) => `
            <div class="response-option ${index === 0 ? 'selected' : ''}" data-response-index="${index}">
                <div class="response-type">
                    <span>${suggestion.emoji}</span>
                    <span>${suggestion.type.toUpperCase()}</span>
                </div>
                <div class="response-text">${suggestion.text}</div>
            </div>
        `).join('');

        // Add click listeners to response options
        document.querySelectorAll('.response-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.response-option').forEach(o => o.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.selectedResponse = suggestions[parseInt(e.currentTarget.dataset.responseIndex)];
            });
        });

        // Set first response as selected by default
        this.selectedResponse = suggestions[0];
        responsePanel.style.display = 'block';
        responsePanel.scrollIntoView({ behavior: 'smooth' });
    }

    async saveDraft() {
        if (!this.selectedResponse || !this.selectedEmail) {
            this.showMessage('Please select a response first', 'error');
            return;
        }

        this.showLoading(true, 'Saving draft to Gmail...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/save-draft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailId: this.selectedEmail.id,
                    responseText: this.selectedResponse.text,
                    tone: this.currentTone
                })
            });

            if (!response.ok) {
                throw new Error(`Save draft failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.showMessage('Draft saved to Gmail successfully!', 'success');
            this.updateStats();
            
        } catch (error) {
            console.error('Save draft error:', error);
            this.showMessage(`Save draft failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    editResponse() {
        if (!this.selectedResponse) {
            this.showMessage('Please select a response first', 'error');
            return;
        }

        const newText = prompt('Edit your response:', this.selectedResponse.text);
        if (newText && newText.trim()) {
            this.selectedResponse.text = newText.trim();
            // Update the display
            const selectedOption = document.querySelector('.response-option.selected');
            if (selectedOption) {
                selectedOption.querySelector('.response-text').textContent = this.selectedResponse.text;
            }
            this.showMessage('Response updated!', 'success');
        }
    }

    generateNewResponse() {
        if (!this.selectedEmail) {
            this.showMessage('Please select an email first', 'error');
            return;
        }
        this.generateAIResponse(this.selectedEmail);
    }

    async loadUserStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/response-history`);
            if (response.ok) {
                const data = await response.json();
                this.updateStatsDisplay(data.stats || {});
            }
        } catch (error) {
            console.log('Could not load stats:', error.message);
        }
    }

    updateStatsDisplay(stats) {
        document.getElementById('emailsIndexed').textContent = stats.emailsIndexed || '0';
        document.getElementById('aiResponses').textContent = stats.aiResponses || '0';
        document.getElementById('timeSaved').textContent = `${stats.timeSaved || '0'}h`;
    }

    updateStats() {
        // Increment AI responses counter
        const currentResponses = parseInt(document.getElementById('aiResponses').textContent);
        document.getElementById('aiResponses').textContent = currentResponses + 1;
        
        // Update time saved (estimate 5 minutes per response)
        const currentTime = parseFloat(document.getElementById('timeSaved').textContent);
        document.getElementById('timeSaved').textContent = `${(currentTime + 0.08).toFixed(1)}h`;
    }

    showLoading(show, message = 'Loading...') {
        const loadingState = document.getElementById('loadingState');
        
        if (show) {
            loadingState.style.display = 'flex';
            const messageElement = loadingState.querySelector('span');
            if (messageElement) {
                messageElement.textContent = message;
            }
        } else {
            loadingState.style.display = 'none';
        }
    }

    showEmptyState() {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emailResults').innerHTML = '';
        this.hideResultsCount();
    }

    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
    }

    hideAIResponsePanel() {
        document.getElementById('aiResponsePanel').style.display = 'none';
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        document.querySelectorAll('.error-message, .success-message').forEach(el => el.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.textContent = message;
        
        // Insert at the top of results panel
        const resultsPanel = document.querySelector('.results-panel');
        resultsPanel.insertBefore(messageDiv, resultsPanel.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    showWelcomeMessage() {
        this.showMessage('Welcome! Try searching for emails like "budget meetings" or "urgent requests"', 'success');
    }

    async testServerConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            if (response.ok) {
                console.log('✅ Server connection successful');
            } else {
                console.warn('⚠️ Server responded with error:', response.status);
            }
        } catch (error) {
            console.error('❌ Server connection failed:', error.message);
            this.showMessage('Warning: Cannot connect to server. Please make sure the server is running on port 3000.', 'error');
        }
    }

    showResultsCount(count) {
        const resultsCount = document.getElementById('resultsCount');
        const resultsNumber = document.getElementById('resultsNumber');
        
        if (resultsCount && resultsNumber) {
            resultsNumber.textContent = count;
            resultsCount.style.display = 'block';
        }
    }

    hideResultsCount() {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.style.display = 'none';
        }
    }

    addScrollIndicator() {
        const resultsContainer = document.getElementById('emailResults');
        if (!resultsContainer) return;

        // Add a subtle scroll indicator at the bottom
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.innerHTML = `
            <div style="text-align: center; padding: 10px; color: #64748b; font-size: 0.9rem;">
                <div style="margin-bottom: 5px;">📜</div>
                <div>Scroll to see more emails</div>
            </div>
        `;
        
        // Add CSS for the scroll indicator
        if (!document.getElementById('scrollIndicatorStyle')) {
            const style = document.createElement('style');
            style.id = 'scrollIndicatorStyle';
            style.textContent = `
                .scroll-indicator {
                    position: sticky;
                    bottom: 0;
                    background: linear-gradient(transparent, rgba(248, 250, 252, 0.9));
                    backdrop-filter: blur(4px);
                    border-top: 1px solid #e2e8f0;
                    margin-top: 10px;
                }
            `;
            document.head.appendChild(style);
        }
        
        resultsContainer.appendChild(scrollIndicator);
    }

    async syncEmails() {
        const syncBtn = document.getElementById('syncBtn');
        const syncStatus = document.getElementById('syncStatus');
        const syncIcon = syncBtn.querySelector('.sync-icon');
        const syncText = syncBtn.querySelector('.sync-text');
        
        // Update button state
        syncBtn.disabled = true;
        syncIcon.textContent = '⏳';
        syncText.textContent = 'Syncing...';
        syncStatus.textContent = 'Indexing emails for search...';
        
        this.showLoading(true, 'Syncing emails...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ maxEmails: 100 })
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Update status
            const indexedCount = data.indexed || data.indexedCount || 0;
            syncStatus.textContent = `✅ Synced ${indexedCount} emails successfully`;
            this.showMessage(`Successfully synced ${indexedCount} emails!`, 'success');
            
            // Update stats
            this.loadUserStats();
            
        } catch (error) {
            console.error('Sync error:', error);
            syncStatus.textContent = '❌ Sync failed';
            this.showMessage(`Sync failed: ${error.message}`, 'error');
        } finally {
            // Reset button state
            syncBtn.disabled = false;
            syncIcon.textContent = '🔄';
            syncText.textContent = 'Sync Emails';
            this.showLoading(false);
            
            // Reset status after 5 seconds
            setTimeout(() => {
                syncStatus.textContent = 'Ready to sync';
            }, 5000);
        }
    }

    // History functionality
    async loadResponseHistory() {
        this.showLoading(true, 'Loading response history...');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/response-history`);
            if (!response.ok) {
                throw new Error(`Failed to load history: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.displayResponseHistory(data.entries || []);
            this.showMessage(`Loaded ${data.entries?.length || 0} history entries`, 'success');
            
        } catch (error) {
            console.error('History load error:', error);
            this.showMessage(`Failed to load history: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayResponseHistory(entries) {
        const historyContainer = document.getElementById('historyContainer');
        const historyList = document.getElementById('historyList');
        
        if (entries.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No response history found</div>';
        } else {
            const htmlContent = entries.map(entry => this.createHistoryItem(entry)).join('');
            historyList.innerHTML = htmlContent;
        }
        
        historyContainer.style.display = 'block';
    }

    createHistoryItem(entry) {
        const date = new Date(entry.timestamp).toLocaleString();
        const statusClass = entry.status === 'selected' ? 'selected' : 'generated';
        const statusText = entry.status === 'selected' ? 'Selected' : 'Generated';
        
        const suggestions = entry.suggestions?.map(s => 
            `<span class="history-suggestion">${s.emoji} ${s.text}</span>`
        ).join('') || '';
        
        return `
            <div class="history-item" data-history-id="${entry.id}">
                <div class="history-item-header">
                    <span class="history-item-date">${date}</span>
                    <span class="history-item-status ${statusClass}">${statusText}</span>
                </div>
                <div class="history-item-email">
                    <span class="from">${entry.email.from}</span>
                    <span class="subject">${entry.email.subject}</span>
                </div>
                <div class="history-item-instruction">"${entry.userInstruction}"</div>
                <div class="history-item-suggestions">${suggestions}</div>
            </div>
        `;
    }

    async clearResponseHistory() {
        if (!confirm('Are you sure you want to clear all response history? This action cannot be undone.')) {
            return;
        }
        
        this.showLoading(true, 'Clearing response history...');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/response-history`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to clear history: ${response.statusText}`);
            }
            
            document.getElementById('historyContainer').style.display = 'none';
            this.showMessage('Response history cleared successfully', 'success');
            
        } catch (error) {
            console.error('Clear history error:', error);
            this.showMessage(`Failed to clear history: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Tone analysis functionality
    async analyzeTone() {
        const input = document.getElementById('toneAnalysisInput').value.trim();
        if (!input) {
            this.showMessage('Please enter some text to analyze', 'error');
            return;
        }
        
        this.showLoading(true, 'Analyzing tone...');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/analyze-tone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ response: input })
            });
            
            if (!response.ok) {
                throw new Error(`Tone analysis failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.displayToneAnalysis(data);
            
        } catch (error) {
            console.error('Tone analysis error:', error);
            this.showMessage(`Tone analysis failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayToneAnalysis(data) {
        const resultContainer = document.getElementById('toneAnalysisResult');
        const analysis = data.analysis || data;
        
        const characteristics = analysis.characteristics ? 
            analysis.characteristics.map(c => `<span class="tone-tag">${c}</span>`).join('') : '';
        
        const suggestions = analysis.suggestions ? 
            analysis.suggestions.map(s => `<li>${s}</li>`).join('') : '';
        
        const htmlContent = `
            <h4>🔍 Tone Analysis Results</h4>
            <div class="tone-info">
                <div class="tone-item">
                    <div class="tone-item-label">Primary Tone</div>
                    <div class="tone-item-value">${analysis.primaryTone || 'Unknown'}</div>
                </div>
                <div class="tone-item">
                    <div class="tone-item-label">Confidence</div>
                    <div class="tone-item-value">
                        <span class="confidence">${analysis.confidence || 0}%</span>
                    </div>
                </div>
            </div>
            ${characteristics ? `
                <div class="tone-characteristics">
                    <h5>Characteristics:</h5>
                    <div class="tone-tags">${characteristics}</div>
                </div>
            ` : ''}
            ${suggestions ? `
                <div class="tone-suggestions">
                    <h5>Suggestions:</h5>
                    <ul>${suggestions}</ul>
                </div>
            ` : ''}
        `;
        
        resultContainer.innerHTML = htmlContent;
        resultContainer.style.display = 'block';
    }

    // Email Summary Helper Methods
    showEmailSummaryLoading(emailId, show) {
        const emailItem = document.querySelector(`[data-email-id="${emailId}"]`).closest('.email-item');
        let summaryContainer = emailItem.querySelector('.email-summary');
        
        if (!summaryContainer) {
            summaryContainer = document.createElement('div');
            summaryContainer.className = 'email-summary';
            emailItem.appendChild(summaryContainer);
        }

        if (show) {
            summaryContainer.innerHTML = `
                <div class="summary-loading">
                    <span>⏳</span>
                    <span>Generating summary...</span>
                </div>
            `;
            summaryContainer.classList.add('show');
        } else {
            summaryContainer.classList.remove('show');
        }
    }

    async displayEmailSummary(emailId, summary) {
        console.log('Displaying summary for email:', emailId);
        console.log('Summary content:', summary);
        
        const emailItem = document.querySelector(`[data-email-id="${emailId}"]`).closest('.email-item');
        console.log('Email item found:', emailItem);
        
        let summaryContainer = emailItem.querySelector('.email-summary');
        
        if (!summaryContainer) {
            summaryContainer = document.createElement('div');
            summaryContainer.className = 'email-summary';
            emailItem.appendChild(summaryContainer);
            console.log('Created new summary container');
        }

        // Display the summary text with Hugging Face TTS button
        summaryContainer.innerHTML = `
            <div class="summary-content">
                <div class="summary-header">
                    <span class="summary-icon">📝</span>
                    <span class="summary-title">Email Summary</span>
                    <button class="tts-read-btn" onclick="smartEmailManager.readSummary('${emailId}')" title="Read Summary with Hugging Face TTS">
                        🔊 Read Summary
                    </button>
                </div>
                <div class="summary-text">${summary}</div>
            </div>
        `;
        
        // Ensure the summary is visible with multiple approaches
        summaryContainer.classList.add('show');
        summaryContainer.style.display = 'block';
        summaryContainer.style.visibility = 'visible';
        summaryContainer.style.opacity = '1';
        
        console.log('Summary displayed and shown');
        console.log('Summary container classes:', summaryContainer.classList.toString());
        console.log('Summary container style display:', summaryContainer.style.display);
        
        // Force a reflow to ensure the display change takes effect
        summaryContainer.offsetHeight;
        
        // Double-check visibility after a short delay
        setTimeout(() => {
            if (!summaryContainer.classList.contains('show')) {
                summaryContainer.classList.add('show');
            }
            if (summaryContainer.style.display === 'none') {
                summaryContainer.style.display = 'block';
            }
            console.log('Post-timeout check - classes:', summaryContainer.classList.toString());
            console.log('Post-timeout check - display:', summaryContainer.style.display);
        }, 100);

        // Store the summary for TTS
        this.currentSummary = summary;
        this.currentEmailId = emailId;
        
        // Force show all email summaries as a fallback
        this.forceShowAllSummaries();
    }

    // Force show all email summaries
    forceShowAllSummaries() {
        const allSummaries = document.querySelectorAll('.email-summary');
        allSummaries.forEach(summary => {
            summary.classList.add('show');
            summary.style.display = 'block';
            summary.style.visibility = 'visible';
            summary.style.opacity = '1';
        });
        console.log(`Forced visibility for ${allSummaries.length} email summaries`);
    }

    // NEW: Hugging Face TTS method (replaces Web Speech API)
    async readSummary(emailId) {
        if (!this.currentSummary) {
            this.showMessage('No summary available for TTS', 'error');
            return;
        }

        try {
            // Use Hugging Face TTS instead of Web Speech API
            await this.hfTTS.playSummarySpeech(emailId, this.currentSummary, this.hfTTS.getCurrentVoiceProfile());
            this.showMessage('🎵 Playing summary with Hugging Face TTS', 'success');
        } catch (error) {
            console.error('Hugging Face TTS error:', error);
            this.showMessage('Hugging Face TTS failed, falling back to Web Speech API', 'error');
            
            // Fallback to Web Speech API
            this.readSummaryWithWebSpeech(emailId);
        }
    }

    // Fallback: Web Speech API method (original implementation)
    readSummaryWithWebSpeech(emailId) {
        if (!this.currentSummary) {
            this.showMessage('No summary available for TTS', 'error');
            return;
        }

        // Stop any current speech
        this.speechSynthesis.cancel();

        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(this.currentSummary);
        
        // Configure speech settings
        this.currentUtterance.rate = this.ttsSettings.rate;
        this.currentUtterance.pitch = this.ttsSettings.pitch;
        this.currentUtterance.volume = this.ttsSettings.volume;
        
        // Set voice if available
        if (this.ttsSettings.voice) {
            this.currentUtterance.voice = this.ttsSettings.voice;
        }

        // Event handlers
        this.currentUtterance.onstart = () => {
            this.ttsSettings.isPlaying = true;
            this.updateReadButton(emailId, '⏹️ Stop Reading', 'stop');
        };

        this.currentUtterance.onend = () => {
            this.ttsSettings.isPlaying = false;
            this.updateReadButton(emailId, '🔊 Read Summary', 'read');
        };

        this.currentUtterance.onerror = (error) => {
            console.error('TTS error:', error);
            this.showMessage('TTS playback failed', 'error');
            this.ttsSettings.isPlaying = false;
            this.updateReadButton(emailId, '🔊 Read Summary', 'read');
        };

        // Start speaking
        this.speechSynthesis.speak(this.currentUtterance);
    }

    stopReading() {
        // Stop Hugging Face TTS
        this.hfTTS.stopSummarySpeech();
        
        // Stop Web Speech API as fallback
        this.speechSynthesis.cancel();
        this.ttsSettings.isPlaying = false;
        
        // Update all read buttons
        document.querySelectorAll('.tts-read-btn').forEach(btn => {
            btn.innerHTML = '🔊 Read Summary';
        });
    }

    updateReadButton(emailId, text, action) {
        const emailItem = document.querySelector(`[data-email-id="${emailId}"]`)?.closest('.email-item');
        if (!emailItem) return;
        
        const readBtn = emailItem.querySelector('.tts-read-btn');
        if (readBtn) {
            readBtn.innerHTML = text;
            readBtn.setAttribute('data-email-id', emailId);
            
            if (action === 'stop') {
                readBtn.onclick = () => this.stopReading();
            } else {
                readBtn.onclick = () => this.readSummary(emailId);
            }
        }
    }

    showEmailSummaryError(emailId, errorMessage) {
        const emailItem = document.querySelector(`[data-email-id="${emailId}"]`).closest('.email-item');
        let summaryContainer = emailItem.querySelector('.email-summary');
        
        if (!summaryContainer) {
            summaryContainer = document.createElement('div');
            summaryContainer.className = 'email-summary';
            emailItem.appendChild(summaryContainer);
        }

        summaryContainer.innerHTML = `
            <div class="summary-error">
                <span>❌</span>
                <span>${errorMessage}</span>
            </div>
        `;
        summaryContainer.classList.add('show');
    }

    // TTS Test functionality
    testTTS() {
        const testResult = document.getElementById('testTTSResult');
        testResult.style.display = 'block';
        this.showMessage('TTS test panel shown. Click "Read Test" to test Hugging Face TTS functionality.', 'success');
    }

    async readTestSummary() {
        const testText = "This is a test of the Hugging Face text-to-speech functionality. If you can hear this, the TTS system is working correctly!";
        
        try {
            // Use Hugging Face TTS for test
            await this.hfTTS.playSummarySpeech('test_summary', testText, 'professional');
            this.showMessage('🎵 Hugging Face TTS test started!', 'success');
        } catch (error) {
            console.error('Hugging Face TTS test error:', error);
            this.showMessage('Hugging Face TTS test failed, using Web Speech API fallback', 'error');
            
            // Fallback to Web Speech API
            this.readTestSummaryWithWebSpeech();
        }
    }

    readTestSummaryWithWebSpeech() {
        const testText = "This is a test of the text-to-speech functionality using Web Speech API fallback. If you can hear this, TTS is working correctly!";
        
        // Stop any current speech
        this.speechSynthesis.cancel();

        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(testText);
        
        // Configure speech settings
        this.currentUtterance.rate = 1.0;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;

        // Event handlers
        this.currentUtterance.onstart = () => {
            this.ttsSettings.isPlaying = true;
            this.showMessage('TTS test started with Web Speech API - you should hear speech now!', 'success');
        };

        this.currentUtterance.onend = () => {
            this.ttsSettings.isPlaying = false;
            this.showMessage('TTS test completed!', 'success');
        };

        this.currentUtterance.onerror = (error) => {
            console.error('TTS test error:', error);
            this.showMessage('TTS test failed: ' + error.message, 'error');
            this.ttsSettings.isPlaying = false;
        };

        // Start speaking
        this.speechSynthesis.speak(this.currentUtterance);
    }

    // Keyboard shortcuts for TTS controls
    handleTTSKeyboardShortcuts(e) {
        // Only handle shortcuts when not typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        switch(e.key) {
            case ' ': // Spacebar - Play/Pause
                e.preventDefault();
                if (this.hfTTS.isCurrentlyPlaying() || this.ttsSettings.isPlaying) {
                    this.stopReading();
                } else if (this.currentSummary) {
                    this.readSummary(this.currentEmailId);
                }
                break;
            case 's': // S key - Stop
                e.preventDefault();
                this.stopReading();
                break;
            case 'p': // P key - Play
                e.preventDefault();
                if (this.currentSummary) {
                    this.readSummary(this.currentEmailId);
                }
                break;
            case 'Escape': // Escape - Stop
                e.preventDefault();
                this.stopReading();
                break;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.smartEmailManager = new SmartEmailManager();
    
    // Add global function to force show summaries (for debugging)
    window.forceShowSummaries = () => {
        if (window.smartEmailManager) {
            window.smartEmailManager.forceShowAllSummaries();
        }
    };
});

// Utility function for viewing full email (called from HTML)
function viewFullEmail(emailId) {
    // This would open a modal or new page with the full email content
    alert(`View full email: ${emailId}\n(This feature can be implemented later)`);
}