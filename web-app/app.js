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
        this.loadAvailableCategories(); // NEW
        this.loadAllLabels(); // Phase 2: Load all labels
        this.loadAllEmails(); // Phase 2: Auto-load all emails on page access
        this.showWelcomeMessage();
    }
    
    // Phase 2: Load all emails automatically on page access
    // Phase 5: Added performance optimization for large lists
    async loadAllEmails() {
        try {
            this.showLoading(true, 'Loading all emails...');
            
            const startTime = performance.now();
            const response = await fetch(`${this.apiBaseUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: '',  // Empty query = get all emails
                    limit: null // No limit = get all
                })
            });
            
            const loadTime = performance.now() - startTime;
            console.log(`Email load time: ${loadTime.toFixed(2)}ms`);

            if (!response.ok) {
                throw new Error(`Failed to load emails: ${response.statusText}`);
            }

            const data = await response.json();
            const results = (data.results || []).map(email => ({
                ...email,
                category: email.category || 'other',
                categoryConfidence: email.categoryConfidence || 0.5
            }));
            
            if (results.length > 0) {
                // Phase 5: Performance optimization - use requestAnimationFrame for large lists
                if (results.length > 100) {
                    this.showMessage(`Loading ${results.length} emails...`, 'info', 1000);
                    // Use requestAnimationFrame to prevent blocking
                    requestAnimationFrame(() => {
                        this.displaySearchResults(results);
                        this.updateCategoryStatistics(results);
                        this.showMessage(`Loaded ${results.length} emails`, 'success', 2000);
                    });
                } else {
                    this.displaySearchResults(results);
                    this.updateCategoryStatistics(results);
                    this.showMessage(`Loaded ${results.length} emails`, 'success', 2000);
                }
            } else {
                this.showEmptyState();
                this.showMessage('No emails found. Sync emails first!', 'info', 3000);
            }
        } catch (error) {
            console.error('Error loading all emails:', error);
            // Don't show error on initial load - might be expected if no emails synced yet
            if (error.message.includes('Failed to fetch')) {
                console.warn('Server not available or no emails synced yet');
            }
        } finally {
            this.showLoading(false);
        }
    }

    async loadAllEmailsFromCache() {
        // "Show All Emails" button - only use Redis cache, don't search ChromaDB
        this.showLoading(true, 'Loading emails from cache...');
        this.hideEmptyState();
        this.hideAIResponsePanel();

        try {
            // Build URL with use_cache_only=true to only use Redis cache
            const url = new URL(`${this.apiBaseUrl}/search`);
            url.searchParams.set('use_cache_only', 'true');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: '',  // Empty query = get all emails
                    limit: null  // No limit = get all
                })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // No cache found - show helpful message
                    this.showMessage('No cached emails found. Please click Search first to load emails.', 'info', 4000);
                    return;
                }
                throw new Error(`Failed to load from cache: ${response.statusText}`);
            }

            const data = await response.json();
            // Ensure all emails have category data (default to 'other' if missing)
            const results = (data.results || []).map(email => ({
                ...email,
                category: email.category || 'other',
                categoryConfidence: email.categoryConfidence || 0.5
            }));
            
            this.currentEmailList = results;
            this.displaySearchResults(results);
            
            // Update category statistics
            this.updateCategoryStatistics(results);
            
            // Show message indicating cache was used
            this.showMessage(`Loaded ${results.length} email${results.length !== 1 ? 's' : ''} from cache`, 'info', 2000);
            
        } catch (error) {
            console.error('Cache load error:', error);
            this.showMessage(`Failed to load from cache: ${error.message}`, 'error');
            this.showEmptyState();
        } finally {
            this.showLoading(false);
        }
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

        // Tone selector - removed from main UI, now only in modal

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

        // AI Response actions (Phase 4: Legacy - now handled in modal)
        // Keep for backward compatibility but they redirect to modal
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        const editResponseBtn = document.getElementById('editResponseBtn');
        const generateNewBtn = document.getElementById('generateNewBtn');
        
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.saveDraft());
        }
        if (editResponseBtn) {
            editResponseBtn.addEventListener('click', () => this.editResponse());
        }
        if (generateNewBtn) {
            generateNewBtn.addEventListener('click', () => this.generateNewResponse());
        }

        // History functionality - removed from main UI
        // const loadHistoryBtn = document.getElementById('loadHistoryBtn');
        // const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        // if (loadHistoryBtn) loadHistoryBtn.addEventListener('click', () => this.loadResponseHistory());
        // if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearResponseHistory());

        // Tone analysis functionality
        // Tone analysis removed from main UI (now available in modal if needed)
        // const analyzeToneBtn = document.getElementById('analyzeToneBtn');
        // if (analyzeToneBtn) {
        //     analyzeToneBtn.addEventListener('click', () => this.analyzeTone());
        // }

        // Keyboard shortcuts for TTS
        document.addEventListener('keydown', (e) => this.handleTTSKeyboardShortcuts(e));

        // TTS test functionality - removed from main UI
        // const testTTSBtn = document.getElementById('testTTSBtn');
        // if (testTTSBtn) testTTSBtn.addEventListener('click', () => this.testTTS());

        // Category change button handlers (delegated event listener)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('change-category-btn')) {
                const emailId = e.target.dataset.emailId;
                this.showCategoryChangeDialog(emailId);
            }
        });

        // Label management event listeners
        const createLabelBtn = document.getElementById('createLabelBtn');
        if (createLabelBtn) {
            createLabelBtn.addEventListener('click', () => this.showLabelModal());
        }

        const labelModalClose = document.getElementById('labelModalClose');
        const labelCancelBtn = document.getElementById('labelCancelBtn');
        if (labelModalClose) {
            labelModalClose.addEventListener('click', () => this.hideLabelModal());
        }
        if (labelCancelBtn) {
            labelCancelBtn.addEventListener('click', () => this.hideLabelModal());
        }

        // Close label modal on overlay click
        const labelModal = document.getElementById('labelModal');
        if (labelModal && !labelModal.hasAttribute('data-listener-added')) {
            labelModal.addEventListener('click', (e) => {
                if (e.target === labelModal) {
                    this.hideLabelModal();
                }
            });
            labelModal.setAttribute('data-listener-added', 'true');
        }

        const labelForm = document.getElementById('labelForm');
        if (labelForm) {
            labelForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createLabel();
            });
        }

        // Label color picker sync
        const labelColor = document.getElementById('labelColor');
        const labelColorText = document.getElementById('labelColorText');
        if (labelColor && labelColorText) {
            labelColor.addEventListener('input', (e) => {
                labelColorText.value = e.target.value;
            });
            labelColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    labelColor.value = e.target.value;
                }
            });
        }

        // Delegated event listeners for label actions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('apply-label-btn')) {
                const labelId = e.target.dataset.labelId;
                this.autoApplyLabel(labelId);
            }
            if (e.target.classList.contains('delete-label-btn')) {
                const labelId = e.target.dataset.labelId;
                this.deleteLabel(labelId);
            }
        });

        // "Show All Emails" button - loads from cache only
        const showAllBtn = document.getElementById('showAllEmailsBtn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.loadAllEmailsFromCache());
        }
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();

        // Search button always performs fresh search from ChromaDB and updates Redis
        this.showLoading(true, query ? 'Searching emails...' : 'Loading all emails...');
        this.hideEmptyState();
        this.hideAIResponsePanel();

        try {
            // Build URL with force_refresh=true to always search ChromaDB
            const url = new URL(`${this.apiBaseUrl}/search`);
            url.searchParams.set('force_refresh', 'true');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: query || '',  // Empty query = get all emails
                    limit: null  // No limit = get all
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            // Ensure all emails have category data (default to 'other' if missing)
            const results = (data.results || []).map(email => ({
                ...email,
                category: email.category || 'other',
                categoryConfidence: email.categoryConfidence || 0.5
            }));
            
            this.currentEmailList = results;
            this.displaySearchResults(results);
            
            // Update category statistics
            this.updateCategoryStatistics(data.results || []);
            
            // Search button always does fresh search, so show success message
            if (query) {
                this.showMessage(`Found ${results.length} email${results.length !== 1 ? 's' : ''} for "${query}"`, 'success', 3000);
            } else {
                this.showMessage(`Loaded ${results.length} email${results.length !== 1 ? 's' : ''} from ChromaDB`, 'success', 2000);
            }
            
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
        // Store current email list for filtering
        this.currentEmailList = emails;
        
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
            
            // Store emails for modal access
            this.currentEmailList = emails;
            
            // Create Gmail-like email rows
            const htmlContent = emails.map(email => this.createEmailRow(email)).join('');
            resultsContainer.innerHTML = htmlContent;
            
            // Add click listeners to email rows (for modal)
            // Phase 5: Also support keyboard navigation
            document.querySelectorAll('.email-row').forEach(row => {
                const handleOpen = (e) => {
                    // Don't trigger if clicking on category badge
                    if (e.target.closest('.category-badge')) {
                        return;
                    }
                    const emailId = row.dataset.emailId;
                    const email = emails.find(e => e.id === emailId);
                    if (email) {
                        this.showEmailModal(email);
                    }
                };
                
                row.addEventListener('click', handleOpen);
                // Phase 5: Keyboard support (Enter and Space)
                row.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(e);
                    }
                });
            });
        } catch (error) {
            console.error('Error displaying results:', error);
            this.showMessage('Error displaying results: ' + error.message, 'error');
        }
    }

    createEmailRow(email) {
        try {
            // Format date - show relative time if recent, otherwise absolute date
            const emailDate = new Date(email.date);
            const now = new Date();
            const diffMs = now - emailDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            let dateDisplay = '';
            if (diffDays === 0) {
                // Today - show time
                dateDisplay = emailDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            } else if (diffDays === 1) {
                dateDisplay = 'Yesterday';
            } else if (diffDays < 7) {
                dateDisplay = emailDate.toLocaleDateString('en-US', { weekday: 'short' });
            } else if (diffDays < 365) {
                dateDisplay = emailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                dateDisplay = emailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
            
            // Extract sender name from email address
            const fromAddress = email.from || 'Unknown';
            const senderName = fromAddress.includes('<') 
                ? fromAddress.split('<')[0].trim() 
                : fromAddress.split('@')[0];
            const senderDisplay = senderName.length > 30 ? senderName.substring(0, 30) + '...' : senderName;
            
            // Subject and snippet - show more content
            const subject = email.subject || 'No Subject';
            const subjectDisplay = subject.length > 100 ? subject.substring(0, 100) + '...' : subject;
            
            // Get more content from email body or snippet
            const emailBody = email.body || email.snippet || '';
            const emailContent = emailBody.trim();
            
            // Show more content - up to 200 characters, with smart truncation
            let snippetDisplay = '';
            if (emailContent.length > 0) {
                // Remove extra whitespace and newlines
                const cleanContent = emailContent.replace(/\s+/g, ' ').trim();
                snippetDisplay = cleanContent.length > 200 ? cleanContent.substring(0, 200) + '...' : cleanContent;
            } else {
                snippetDisplay = 'No preview available';
            }
            
            // Category classification - use improved tags with descriptions
            const category = email.category || 'other';
            const confidence = email.categoryConfidence || 0.5;
            const def = this.getCategoryDefinition(category);
            
            // Category badge - now shows text tag instead of just icon
            const categoryBadge = `
                <span class="email-type-tag category-${category}" 
                      style="background-color: ${def.color}; color: white; border: 1px solid ${def.color};"
                      title="${def.description}">
                    ${def.name}
                </span>
            `;
            
            // Get labels for this email
            const emailLabels = this.getEmailLabels(email);
            const labelsHTML = this.formatLabelsHTML(emailLabels);
            
            // Mark as unread/bold if needed (you can add logic here)
            const isUnread = false; // TODO: Add unread tracking
            
            // Phase 5: Accessibility improvements
            return `
                <div class="email-row ${isUnread ? 'email-unread' : ''}" 
                     data-email-id="${email.id}" 
                     data-category="${category}"
                     title="Click to view full email"
                     role="button"
                     tabindex="0"
                     aria-label="Email from ${senderDisplay}, subject: ${subjectDisplay}"
                     aria-describedby="email-snippet-${email.id}">
                    <div class="email-row-from-col">
                        <div class="email-row-category-tag">${categoryBadge}</div>
                        ${labelsHTML ? `<div class="email-row-labels">${labelsHTML}</div>` : ''}
                        <div class="email-row-from">${senderDisplay}</div>
                        </div>
                    <div class="email-row-content">
                        <div class="email-row-subject">${subjectDisplay}</div>
                        <div class="email-row-snippet" 
                             id="email-snippet-${email.id}"
                             title="${emailContent.length > 200 ? emailContent : ''}">${snippetDisplay}</div>
                    </div>
                    <div class="email-row-date">${dateDisplay}</div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating email row:', error);
            return `
                <div class="email-row">
                    <div class="email-row-from">Error</div>
                    <div class="email-row-content">
                        <div class="email-row-subject">Failed to display email</div>
                        <div class="email-row-snippet">${error.message}</div>
                    </div>
                    <div class="email-row-date">-</div>
                </div>
            `;
        }
    }

    // Keep old method for backward compatibility (will be removed in Phase 3)
    createEmailItem(email) {
        return this.createEmailRow(email);
    }
    
    // Phase 3: Email Detail Modal
    showEmailModal(email) {
        this.selectedEmail = email;
        const modal = document.getElementById('emailModal');
        if (!modal) {
            console.error('Email modal not found');
            return;
        }

        // Phase 5: Accessibility - Set ARIA attributes
        modal.setAttribute('aria-hidden', 'false');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'modalSubject');
        modal.setAttribute('aria-modal', 'true');

        // Populate email headers
        const fromAddress = email.from || 'Unknown';
        const toAddress = email.to || 'You';
        const subject = email.subject || 'No Subject';
        const emailDate = new Date(email.date);
        const formattedDate = emailDate.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        document.getElementById('modalFrom').textContent = fromAddress;
        document.getElementById('modalTo').textContent = toAddress;
        const subjectElement = document.getElementById('modalSubject');
        subjectElement.textContent = subject;
        subjectElement.id = 'modalSubject'; // Ensure ID exists for ARIA
        document.getElementById('modalDate').textContent = formattedDate;

        // Populate email body - Phase 5: Sanitize HTML to prevent XSS
        const emailBody = email.body || email.snippet || 'No content available';
        const bodyElement = document.getElementById('modalBody');
        // Preserve line breaks and format text, but escape HTML to prevent XSS
        const safeBody = this.sanitizeHTML(emailBody);
        bodyElement.innerHTML = safeBody.replace(/\n/g, '<br>').replace(/\r/g, '');

        // Hide results section initially
        document.getElementById('modalResults').style.display = 'none';
        document.getElementById('modalSaveDraftBtn').style.display = 'none';
        
        // Phase 5: Clear and sync instruction input in modal
        const modalInstructionInput = document.getElementById('modalResponseInstruction');
        const modalRagToggle = document.getElementById('modalRagModeToggle');
        
        if (modalInstructionInput) {
            modalInstructionInput.value = '';
        }
        
        // Set default tone in modal (professional)
        const toneButtonsModal = document.querySelectorAll('.tone-btn-modal');
        toneButtonsModal.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tone === this.currentTone || btn.dataset.tone === 'professional') {
                btn.classList.add('active');
                this.currentTone = btn.dataset.tone;
            }
        });
        
        // Set RAG toggle state
        if (modalRagToggle) {
            modalRagToggle.checked = this.useRAG;
        }

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Phase 5: Focus management for accessibility
        const closeBtn = document.getElementById('emailModalClose');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 100);
        }

        // Setup event listeners (if not already set up)
        this.setupModalEventListeners();
    }

    hideEmailModal() {
        const modal = document.getElementById('emailModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = ''; // Restore scrolling
            
            // Phase 5: Return focus to email row that opened modal
            const activeRow = document.querySelector('.email-row[data-email-id="' + (this.selectedEmail?.id || '') + '"]');
            if (activeRow) {
                activeRow.focus();
            }
        }
    }

    // Phase 5: Basic HTML sanitization to prevent XSS
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    setupModalEventListeners() {
        // Close button
        const closeBtn = document.getElementById('emailModalClose');
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', () => this.hideEmailModal());
            closeBtn.setAttribute('data-listener-added', 'true');
        }

        // Close on overlay click
        const modal = document.getElementById('emailModal');
        if (modal && !modal.hasAttribute('data-listener-added')) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideEmailModal();
                }
            });
            modal.setAttribute('data-listener-added', 'true');
        }

        // ESC key to close
        if (!this.modalEscListener) {
            this.modalEscListener = (e) => {
                if (e.key === 'Escape') {
                    const emailModal = document.getElementById('emailModal');
                    const labelModal = document.getElementById('labelModal');
                    if (emailModal && emailModal.style.display !== 'none') {
                        this.hideEmailModal();
                    } else if (labelModal && labelModal.style.display !== 'none') {
                        this.hideLabelModal();
                    }
                }
            };
            document.addEventListener('keydown', this.modalEscListener);
        }

        // Modal action buttons
        const summarizeBtn = document.getElementById('modalSummarizeBtn');
        if (summarizeBtn && !summarizeBtn.hasAttribute('data-listener-added')) {
            summarizeBtn.addEventListener('click', () => {
                if (this.selectedEmail) {
                    this.summarizeEmailInModal(this.selectedEmail);
                }
            });
            summarizeBtn.setAttribute('data-listener-added', 'true');
        }

        const responseBtn = document.getElementById('modalResponseBtn');
        if (responseBtn && !responseBtn.hasAttribute('data-listener-added')) {
            responseBtn.addEventListener('click', () => {
                if (this.selectedEmail) {
                    this.generateResponseInModal(this.selectedEmail);
                }
            });
            responseBtn.setAttribute('data-listener-added', 'true');
        }

        const saveDraftBtn = document.getElementById('modalSaveDraftBtn');
        if (saveDraftBtn && !saveDraftBtn.hasAttribute('data-listener-added')) {
            saveDraftBtn.addEventListener('click', () => {
                this.saveDraftFromModal();
            });
            saveDraftBtn.setAttribute('data-listener-added', 'true');
        }

        // Phase 5: Quick instruction buttons in modal
        const quickButtons = document.querySelectorAll('.quick-btn-modal');
        quickButtons.forEach(btn => {
            if (!btn.hasAttribute('data-listener-added')) {
                btn.addEventListener('click', (e) => {
                    const instruction = e.target.dataset.instruction;
                    const instructionInput = document.getElementById('modalResponseInstruction');
                    if (instructionInput) {
                        instructionInput.value = instruction;
                        instructionInput.focus();
                    }
                });
                btn.setAttribute('data-listener-added', 'true');
            }
        });

        // Phase 5: Tone selector in modal
        const toneButtonsModal = document.querySelectorAll('.tone-btn-modal');
        toneButtonsModal.forEach(btn => {
            if (!btn.hasAttribute('data-listener-added')) {
                btn.addEventListener('click', () => {
                    toneButtonsModal.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.currentTone = btn.dataset.tone;
                    console.log(`Tone changed to: ${this.currentTone}`);
                });
                btn.setAttribute('data-listener-added', 'true');
            }
        });

        // Phase 5: RAG mode toggle in modal
        const modalRagToggle = document.getElementById('modalRagModeToggle');
        if (modalRagToggle) {
            if (!modalRagToggle.hasAttribute('data-listener-added')) {
                modalRagToggle.addEventListener('change', (e) => {
                    this.useRAG = e.target.checked;
                    console.log(`RAG mode: ${this.useRAG ? 'enabled' : 'disabled'}`);
                });
                modalRagToggle.setAttribute('data-listener-added', 'true');
            }
        }
    }

    async generateAIResponse(email) {
        // Phase 4: Redirect to modal instead of old panel
        // Open modal first, then generate response
        this.showEmailModal(email);
        // Small delay to ensure modal is open, then trigger response generation
        setTimeout(() => {
            this.generateResponseInModal(email);
        }, 100);
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

    // Phase 3: Summarize email in modal
    async summarizeEmailInModal(email) {
        const resultsDiv = document.getElementById('modalResults');
        const summarizeBtn = document.getElementById('modalSummarizeBtn');
        
        try {
            summarizeBtn.disabled = true;
            summarizeBtn.textContent = '⏳ Summarizing...';
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="modal-loading">⏳ Generating summary...</div>';

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
            const summary = data.summary || 'No summary available';
            
            // Store summary for TTS
            this.currentSummary = summary;
            this.currentEmailId = email.id;
            
            resultsDiv.innerHTML = `
                <div class="modal-result-section">
                    <h4>📝 Email Summary</h4>
                    <div class="modal-result-content">${summary.replace(/\n/g, '<br>')}</div>
                    <div class="modal-result-actions" style="margin-top: 12px;">
                        <button class="tts-read-btn action-btn btn-info" 
                                onclick="window.smartEmailManager.readSummary('${email.id}')" 
                                title="Read Summary with Hugging Face TTS">
                            🎵 Read Summary
                        </button>
                    </div>
                </div>
            `;
            
            this.showMessage('Summary generated successfully!', 'success', 2000);
        } catch (error) {
            console.error('Email summarization error:', error);
            resultsDiv.innerHTML = `
                <div class="modal-result-section modal-error">
                    <h4>❌ Error</h4>
                    <div class="modal-result-content">Summarization failed: ${error.message}</div>
                </div>
            `;
            this.showMessage(`Summarization failed: ${error.message}`, 'error');
        } finally {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = '📝 Summarize';
        }
    }

    // Phase 3: Generate response in modal
    async generateResponseInModal(email) {
        const resultsDiv = document.getElementById('modalResults');
        const responseBtn = document.getElementById('modalResponseBtn');
        const saveDraftBtn = document.getElementById('modalSaveDraftBtn');
        
        try {
            responseBtn.disabled = true;
            responseBtn.textContent = '⏳ Generating...';
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="modal-loading">⏳ Generating AI response...</div>';

            const useRAG = this.useRAG;
            // Phase 5: Get instruction from modal input (preferred) or fallback to main input
            const modalInstructionInput = document.getElementById('modalResponseInstruction');
            const mainInstructionInput = document.getElementById('responseInstruction');
            const instructionInput = modalInstructionInput || mainInstructionInput;
            const userInstruction = instructionInput?.value.trim() || 'Generate a helpful response';

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
                        contextEmailsLimit: useRAG ? 3 : undefined
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`AI response generation failed: ${response.statusText}`);
            }

            const data = await response.json();
            const suggestions = data.suggestions || [];
            const analysis = data.analysis || {};
            
            if (suggestions.length > 0) {
                // Store selected response for save draft
                this.selectedResponse = suggestions[0];
                
                // Show RAG context info if used
        let contextInfo = '';
                if (analysis.contextUsed || (data.metadata && data.metadata.contextEmailsUsed > 0)) {
                    const contextCount = analysis.contextEmailsCount || data.metadata?.contextEmailsUsed || 0;
            contextInfo = `<div class="rag-context-info" style="margin-bottom: 10px; padding: 8px; background: #e0f2fe; border-radius: 6px; font-size: 12px; color: #0369a1;">
                🧠 Used ${contextCount} similar emails as context
            </div>`;
        }
        
                // Display response suggestions with email-like formatting
                const responseHTML = suggestions.map((suggestion, index) => {
                    // Format response as email preview
                    const fromEmail = 'Your Email';
                    const toEmail = email.from || 'Recipient';
                    const subject = email.subject ? `Re: ${email.subject}` : 'Re: Email';
                    const currentDate = new Date().toLocaleString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    const formattedText = suggestion.text.replace(/\n/g, '<br>');
                    
                    return `
                    <div class="modal-response-option ${index === 0 ? 'selected' : ''}" data-response-index="${index}">
                        <div class="modal-response-type">
                    <span>${suggestion.emoji}</span>
                    <span>${suggestion.type.toUpperCase()}</span>
                </div>
                        <div class="email-preview-container">
                            <div class="email-headers">
                                <div class="email-header-row">
                                    <span class="email-header-label">From:</span>
                                    <span class="email-header-value">${fromEmail}</span>
            </div>
                                <div class="email-header-row">
                                    <span class="email-header-label">To:</span>
                                    <span class="email-header-value">${toEmail}</span>
                                </div>
                                <div class="email-header-row">
                                    <span class="email-header-label">Subject:</span>
                                    <span class="email-header-value">${subject}</span>
                                </div>
                                <div class="email-header-row">
                                    <span class="email-header-label">Date:</span>
                                    <span class="email-header-value">${currentDate}</span>
                                </div>
                            </div>
                            <div class="email-body">
                                <div class="response-text">${formattedText}</div>
                            </div>
                        </div>
                    </div>
                `;
                }).join('');

                resultsDiv.innerHTML = `
                    <div class="modal-result-section">
                        <h4>🤖 AI Response Suggestions</h4>
                        ${contextInfo}
                        <div class="modal-response-options">${responseHTML}</div>
                    </div>
                `;

        // Add click listeners to response options
                document.querySelectorAll('.modal-response-option').forEach(option => {
            option.addEventListener('click', (e) => {
                        document.querySelectorAll('.modal-response-option').forEach(o => o.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                        const index = parseInt(e.currentTarget.dataset.responseIndex);
                        this.selectedResponse = suggestions[index];
            });
        });

                // Show save draft button
                saveDraftBtn.style.display = 'inline-block';
                
                // Phase 5: Clear instruction input after successful generation
                const modalInstructionInput = document.getElementById('modalResponseInstruction');
                if (modalInstructionInput) {
                    modalInstructionInput.value = '';
                }
                
                this.showMessage('Response generated successfully!', 'success', 2000);
            } else {
                resultsDiv.innerHTML = `
                    <div class="modal-result-section">
                        <h4>🤖 AI Response</h4>
                        <div class="modal-result-content">No response suggestions available.</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('AI response error:', error);
            resultsDiv.innerHTML = `
                <div class="modal-result-section modal-error">
                    <h4>❌ Error</h4>
                    <div class="modal-result-content">Response generation failed: ${error.message}</div>
                </div>
            `;
            this.showMessage(`Response generation failed: ${error.message}`, 'error');
        } finally {
            responseBtn.disabled = false;
            responseBtn.textContent = '🤖 Generate Response';
        }
    }

    // Phase 3: Save draft from modal
    async saveDraftFromModal() {
        if (!this.selectedResponse || !this.selectedEmail) {
            this.showMessage('Please generate a response first', 'error');
            return;
        }

        try {
            const saveDraftBtn = document.getElementById('modalSaveDraftBtn');
            saveDraftBtn.disabled = true;
            saveDraftBtn.textContent = '⏳ Saving...';

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

            this.showMessage('Draft saved to Gmail successfully!', 'success');
            this.updateStats();
        } catch (error) {
            console.error('Save draft error:', error);
            this.showMessage(`Save draft failed: ${error.message}`, 'error');
        } finally {
            const saveDraftBtn = document.getElementById('modalSaveDraftBtn');
            saveDraftBtn.disabled = false;
            saveDraftBtn.textContent = '💾 Save Draft';
        }
    }

    // Phase 4: Legacy method - now redirects to modal
    displayAIResponse(suggestions, analysis = {}) {
        // This method is deprecated - responses now show in modal
        // Keep for backward compatibility but redirect to modal
        if (this.selectedEmail) {
            this.showEmailModal(this.selectedEmail);
            // Display responses in modal results section
            const resultsDiv = document.getElementById('modalResults');
            if (resultsDiv && suggestions.length > 0) {
                this.selectedResponse = suggestions[0];
                const responseHTML = suggestions.map((suggestion, index) => `
                    <div class="modal-response-option ${index === 0 ? 'selected' : ''}" data-response-index="${index}">
                        <div class="modal-response-type">
                            <span>${suggestion.emoji}</span>
                            <span>${suggestion.type.toUpperCase()}</span>
                        </div>
                        <div class="modal-response-text">${suggestion.text.replace(/\n/g, '<br>')}</div>
                    </div>
                `).join('');

                resultsDiv.innerHTML = `
                    <div class="modal-result-section">
                        <h4>🤖 AI Response Suggestions</h4>
                        ${analysis.contextUsed ? `<div class="rag-context-info" style="margin-bottom: 10px; padding: 8px; background: #e0f2fe; border-radius: 6px; font-size: 12px; color: #0369a1;">
                            🧠 Used ${analysis.contextEmailsCount || 0} similar emails as context
                        </div>` : ''}
                        <div class="modal-response-options">${responseHTML}</div>
                    </div>
                `;
                resultsDiv.style.display = 'block';
                document.getElementById('modalSaveDraftBtn').style.display = 'inline-block';

                // Add click listeners
                document.querySelectorAll('.modal-response-option').forEach(option => {
                    option.addEventListener('click', (e) => {
                        document.querySelectorAll('.modal-response-option').forEach(o => o.classList.remove('selected'));
                        e.currentTarget.classList.add('selected');
                        const index = parseInt(e.currentTarget.dataset.responseIndex);
                        this.selectedResponse = suggestions[index];
                    });
                });
            }
        }
    }

    // Phase 4: Legacy methods - redirect to modal
    async saveDraft() {
        // Redirect to modal save draft if modal is open
        const modal = document.getElementById('emailModal');
        if (modal && modal.style.display !== 'none') {
            return this.saveDraftFromModal();
        }
        
        // Fallback for old panel (shouldn't be used anymore)
        if (!this.selectedResponse || !this.selectedEmail) {
            this.showMessage('Please open an email in the modal and generate a response first', 'error');
            return;
        }
        return this.saveDraftFromModal();
    }

    editResponse() {
        // Phase 4: Edit functionality can be added to modal if needed
        this.showMessage('Please use the modal to view and edit responses', 'info');
    }

    generateNewResponse() {
        // Phase 4: Redirect to modal
        if (!this.selectedEmail) {
            this.showMessage('Please select an email first', 'error');
            return;
        }
        this.showEmailModal(this.selectedEmail);
        setTimeout(() => {
            this.generateResponseInModal(this.selectedEmail);
        }, 100);
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
        // Phase 4: Old panel is deprecated, but keep method for compatibility
        const panel = document.getElementById('aiResponsePanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    showMessage(message, type = 'info', duration = 5000) {
        // Remove existing messages
        document.querySelectorAll('.error-message, .success-message, .info-message').forEach(el => el.remove());
        
        const messageDiv = document.createElement('div');
        if (type === 'error') {
            messageDiv.className = 'error-message';
        } else if (type === 'success') {
            messageDiv.className = 'success-message';
        } else {
            messageDiv.className = 'info-message';
        }
        messageDiv.textContent = message;
        
        // Insert at the top of results panel
        const resultsPanel = document.querySelector('.results-panel');
        if (resultsPanel) {
        resultsPanel.insertBefore(messageDiv, resultsPanel.firstChild);
        }
        
        // Auto-remove after specified duration
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, duration);
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

    // Update category statistics display
    // Category definitions with descriptions
    getCategoryDefinition(category) {
        const definitions = {
            'marketing': {
                name: 'Marketing',
                description: 'Promotional content and advertisements',
                color: '#f59e0b',
                emoji: '📢'
            },
            'notification': {
                name: 'Notification',
                description: 'System alerts and updates',
                color: '#ef4444',
                emoji: '🔔'
            },
            'work': {
                name: 'Work',
                description: 'Professional and business-related emails',
                color: '#3b82f6',
                emoji: '💼'
            },
            'personal': {
                name: 'Personal',
                description: 'Personal communications from friends and family',
                color: '#8b5cf6',
                emoji: '👤'
            },
            'newsletter': {
                name: 'Newsletter',
                description: 'Subscribed newsletters and updates',
                color: '#10b981',
                emoji: '📰'
            },
            'finance': {
                name: 'Finance',
                description: 'Financial transactions and statements',
                color: '#06b6d4',
                emoji: '💰'
            },
            'social': {
                name: 'Social',
                description: 'Social media notifications and updates',
                color: '#ec4899',
                emoji: '👥'
            },
            'spam': {
                name: 'Spam',
                description: 'Unwanted or suspicious emails',
                color: '#6b7280',
                emoji: '🚫'
            },
            'promotion': {
                name: 'Promotion',
                description: 'Sales and promotional offers',
                color: '#f59e0b',
                emoji: '🛍️'
            },
            'other': {
                name: 'Other',
                description: 'Uncategorized or miscellaneous emails',
                color: '#94a3b8',
                emoji: '📧'
            }
        };
        return definitions[category] || definitions['other'];
    }

    updateCategoryStatistics(emails) {
        if (!emails || emails.length === 0) {
            const statsContainer = document.getElementById('emailTypeStatistics');
            if (statsContainer) {
                statsContainer.style.display = 'none';
            }
            return;
        }
        
        // Count emails by category
        const categoryCounts = {};
        emails.forEach(email => {
            const category = email.category || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        
        // Display statistics in new panel
        const statsContainer = document.getElementById('emailTypeStatistics');
        const statsList = document.getElementById('emailTypeStatsList');
        const totalElement = document.getElementById('emailTypeTotal');
        
        if (!statsContainer || !statsList || !totalElement) return;
        
        // Update total
        totalElement.textContent = emails.length;
        
        // Create statistics HTML
        const statsHTML = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by count
            .map(([category, count]) => {
                const percentage = ((count / emails.length) * 100).toFixed(1);
                const def = this.getCategoryDefinition(category);
                const barWidth = Math.max(percentage, 5); // Minimum 5% width for visibility
                
                return `
                    <div class="email-type-stat-item" 
                         data-category="${category}" 
                         title="${def.description}"
                         role="button"
                         tabindex="0">
                        <div class="email-type-stat-info">
                            <span class="email-type-stat-name">${def.name}</span>
                            <span class="email-type-stat-count">${count}</span>
                        </div>
                        <div class="email-type-stat-bar-container">
                            <div class="email-type-stat-bar" 
                                 style="width: ${barWidth}%; background-color: ${def.color};"></div>
                        </div>
                        <div class="email-type-stat-percentage">${percentage}%</div>
                    </div>
                `;
            }).join('');
        
        statsList.innerHTML = statsHTML;
        statsContainer.style.display = 'block';
        
        // Add click listeners for filtering
        document.querySelectorAll('.email-type-stat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.filterByCategory(category);
            });
            
            // Keyboard support
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const category = e.currentTarget.dataset.category;
                    this.filterByCategory(category);
                }
            });
        });
    }

    async filterByCategory(category) {
        if (category === 'all' || !category) {
            // Show all emails - perform search without category filter
            await this.performSearchWithCategory(null);
            const showAllBtn = document.getElementById('showAllEmailsBtn');
            if (showAllBtn) showAllBtn.style.display = 'none';
        } else {
            // Search with category filter (will use Redis cache if available)
            await this.performSearchWithCategory(category);
            const showAllBtn = document.getElementById('showAllEmailsBtn');
            if (showAllBtn) showAllBtn.style.display = 'block';
        }
    }

    async performSearchWithCategory(category) {
        // Clear search input when filtering by category
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        this.showLoading(true, category ? `Loading ${category} emails...` : 'Loading all emails...');
        this.hideEmptyState();
        this.hideAIResponsePanel();

        try {
            // Build URL with category query parameter
            const url = new URL(`${this.apiBaseUrl}/search`);
            if (category) {
                url.searchParams.set('category', category);
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: '',  // Empty query = get all emails
                    limit: null  // No limit = get all
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            // Ensure all emails have category data (default to 'other' if missing)
            const results = (data.results || []).map(email => ({
                ...email,
                category: email.category || 'other',
                categoryConfidence: email.categoryConfidence || 0.5
            }));
            
            this.currentEmailList = results;
            this.displaySearchResults(results);
            
            // Update category statistics
            this.updateCategoryStatistics(results);
            
            // Show appropriate message
            if (category) {
                const def = this.getCategoryDefinition(category);
                const cacheInfo = data.cached ? ' (from cache)' : '';
                this.showMessage(`Showing ${results.length} ${def.name.toLowerCase()} emails${cacheInfo}`, 'info', 2000);
            } else {
                const cacheInfo = data.cached ? ' (from cache)' : '';
                this.showMessage(`Showing all ${results.length} emails${cacheInfo}`, 'info', 2000);
            }
            
        } catch (error) {
            console.error('Category filter error:', error);
            this.showMessage(`Failed to load emails: ${error.message}`, 'error');
            this.showEmptyState();
        } finally {
            this.showLoading(false);
        }
    }

    // Handle category change (future enhancement - manual override)
    async changeEmailCategory(emailId, newCategory) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/classify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailId: emailId,
                    category: newCategory,
                    manualOverride: true
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update category');
            }
            
            this.showMessage('Category updated successfully!', 'success');
            // Refresh search results
            this.performSearch();
        } catch (error) {
            console.error('Category change error:', error);
            this.showMessage(`Failed to change category: ${error.message}`, 'error');
        }
    }

    // Show category change dialog
    showCategoryChangeDialog(emailId) {
        const categories = ['work', 'personal', 'promotion', 'marketing', 'newsletter', 
                           'notification', 'social', 'finance', 'other'];
        const categoryNames = categories.map(c => `${c.charAt(0).toUpperCase() + c.slice(1)}`);
        const categoryList = categories.map((c, i) => `${i + 1}. ${c.charAt(0).toUpperCase() + c.slice(1)}`).join('\n');
        
        const selectedIndex = prompt(
            `Change email category:\n\n${categoryList}\n\nEnter number (1-${categories.length}):`
        );
        
        if (selectedIndex && parseInt(selectedIndex) >= 1 && parseInt(selectedIndex) <= categories.length) {
            const newCategory = categories[parseInt(selectedIndex) - 1];
            this.changeEmailCategory(emailId, newCategory);
        }
    }

    // Load available categories from API (optional, for future use)
    async loadAvailableCategories() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/categories`);
            if (response.ok) {
                const data = await response.json();
                console.log('Available categories:', data.categories);
            }
        } catch (error) {
            // Silently fail - categories are shown on email cards anyway
            console.log('Could not load categories:', error.message);
        }
    }

    // ========== Label Management Functions ==========

    async loadAllLabels() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/labels`);
            if (!response.ok) {
                throw new Error('Failed to load labels');
            }
            const data = await response.json();
            this.allLabels = data.labels || [];
            this.displayLabels();
        } catch (error) {
            console.error('Error loading labels:', error);
            this.allLabels = [];
            this.displayLabels();
        }
    }

    displayLabels() {
        const labelsList = document.getElementById('labelsList');
        if (!labelsList) return;

        if (!this.allLabels || this.allLabels.length === 0) {
            labelsList.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; padding: 10px; text-align: center;">No labels yet. Create one to get started!</div>';
            return;
        }

        labelsList.innerHTML = this.allLabels.map(label => {
            const color = label.color || '#6b7280';
            return `
                <div class="label-item" data-label-id="${label.id}">
                    <div class="label-item-header">
                        <span class="label-badge" style="background-color: ${color};">
                            ${label.name}
                        </span>
                        <span class="label-email-count">${label.emailCount || 0} emails</span>
                    </div>
                    <div class="label-item-description">${label.description || ''}</div>
                    <div class="label-item-actions">
                        <button class="apply-label-btn action-btn btn-secondary btn-small" data-label-id="${label.id}" title="Apply this label to matching emails">
                            🔍 Auto-Apply
                        </button>
                        <button class="delete-label-btn action-btn btn-danger btn-small" data-label-id="${label.id}" title="Delete this label">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    showLabelModal() {
        const modal = document.getElementById('labelModal');
        if (!modal) return;

        // Reset form
        document.getElementById('labelName').value = '';
        document.getElementById('labelDescription').value = '';
        document.getElementById('labelPrompt').value = '';
        document.getElementById('labelColor').value = '#6b7280';
        document.getElementById('labelColorText').value = '#6b7280';
        document.getElementById('labelModalTitle').textContent = 'Create New Label';
        document.getElementById('labelSaveBtn').textContent = 'Create Label';

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus on first input
        setTimeout(() => {
            document.getElementById('labelName').focus();
        }, 100);
    }

    hideLabelModal() {
        const modal = document.getElementById('labelModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    async createLabel() {
        const name = document.getElementById('labelName').value.trim();
        const description = document.getElementById('labelDescription').value.trim();
        const prompt = document.getElementById('labelPrompt').value.trim();
        const color = document.getElementById('labelColorText').value.trim() || '#6b7280';

        if (!name || !description || !prompt) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        try {
            this.showLoading(true, 'Creating label...');
            const response = await fetch(`${this.apiBaseUrl}/labels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    description,
                    prompt,
                    color
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create label');
            }

            const data = await response.json();
            this.showMessage(`Label "${name}" created successfully!`, 'success', 3000);
            this.hideLabelModal();
            await this.loadAllLabels();
        } catch (error) {
            console.error('Error creating label:', error);
            this.showMessage(`Failed to create label: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async autoApplyLabel(labelId) {
        const label = this.allLabels.find(l => l.id === labelId);
        if (!label) {
            this.showMessage('Label not found', 'error');
            return;
        }

        if (!confirm(`Apply label "${label.name}" to all matching emails? This may take a while...`)) {
            return;
        }

        try {
            this.showLoading(true, `Applying label "${label.name}" to matching emails...`);
            const response = await fetch(`${this.apiBaseUrl}/labels/${labelId}/apply`, {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to apply label');
            }

            const data = await response.json();
            this.showMessage(`Label applied to ${data.emailCount || 0} emails!`, 'success', 3000);
            await this.loadAllLabels();
            // Refresh email list to show updated labels
            this.performSearch();
        } catch (error) {
            console.error('Error applying label:', error);
            this.showMessage(`Failed to apply label: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteLabel(labelId) {
        const label = this.allLabels.find(l => l.id === labelId);
        if (!label) {
            this.showMessage('Label not found', 'error');
            return;
        }

        if (!confirm(`Delete label "${label.name}"? This will remove it from all emails.`)) {
            return;
        }

        try {
            this.showLoading(true, 'Deleting label...');
            const response = await fetch(`${this.apiBaseUrl}/labels/${labelId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete label');
            }

            this.showMessage(`Label "${label.name}" deleted successfully!`, 'success', 3000);
            await this.loadAllLabels();
            // Refresh email list
            this.performSearch();
        } catch (error) {
            console.error('Error deleting label:', error);
            this.showMessage(`Failed to delete label: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Get labels for an email (from metadata)
    getEmailLabels(email) {
        if (!email || !this.allLabels || !this.allLabels.length) return [];
        const labelsStr = email.labels || '';
        if (!labelsStr || labelsStr.trim() === '') return [];
        const labelIds = labelsStr.split(',').map(id => id.trim()).filter(id => id && id !== '');
        if (labelIds.length === 0) return [];
        return this.allLabels.filter(label => labelIds.includes(label.id));
    }

    // Format labels HTML for display
    formatLabelsHTML(labels) {
        if (!labels || labels.length === 0) return '';
        return labels.map(label => {
            const color = label.color || '#6b7280';
            return `<span class="email-label-badge" style="background-color: ${color};" title="${label.description || label.name}">${label.name}</span>`;
        }).join('');
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
    // Phase 4: Now opens modal instead
    if (window.smartEmailManager && window.smartEmailManager.currentEmailList) {
        const email = window.smartEmailManager.currentEmailList.find(e => e.id === emailId);
        if (email) {
            window.smartEmailManager.showEmailModal(email);
            return;
        }
    }
    alert(`View full email: ${emailId}\n(Email not found in current list)`);
}