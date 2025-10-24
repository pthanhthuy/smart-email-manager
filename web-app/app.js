// Smart Email Manager - JavaScript Application

class SmartEmailManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001';
        this.currentTone = 'professional';
        this.selectedEmail = null;
        this.selectedResponse = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
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
            this.showMessage(`Search failed: ${error.message}`, 'error');
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
        this.showLoading(true, 'Generating AI response...');

        // Get user instruction from the input field
        const instructionInput = document.getElementById('responseInstruction');
        const userInstruction = instructionInput.value.trim() || 'Generate a helpful response';

        try {
            const response = await fetch(`${this.apiBaseUrl}/generate-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailData: email,
                    userInstruction: userInstruction,
                    options: {
                        tone: this.currentTone
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`AI response generation failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.displayAIResponse(data.suggestions || []);
            
            // Clear the instruction field after successful generation
            const instructionInput = document.getElementById('responseInstruction');
            instructionInput.value = '';
            
        } catch (error) {
            console.error('AI response error:', error);
            this.showMessage(`AI response failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayAIResponse(suggestions) {
        const responsePanel = document.getElementById('aiResponsePanel');
        const optionsContainer = document.getElementById('responseOptions');
        
        optionsContainer.innerHTML = suggestions.map((suggestion, index) => `
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.smartEmailManager = new SmartEmailManager();
});

// Utility function for viewing full email (called from HTML)
function viewFullEmail(emailId) {
    // This would open a modal or new page with the full email content
    alert(`View full email: ${emailId}\n(This feature can be implemented later)`);
}
