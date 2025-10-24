//
//  responseHistoryService.js
//  Smart Email Manager
//
//  Created by AI Assistant on 20/1/25.
//  Copyright © 2025 Smart Email Manager. All rights reserved.
//

const fs = require('fs').promises;
const path = require('path');

class ResponseHistoryService {
  constructor() {
    this.historyFile = path.join(__dirname, 'response-history.json');
    this.maxHistorySize = 100; // Keep last 100 response generations
  }

  /**
   * Load response history from file
   * @returns {Array} Array of response history entries
   */
  async loadHistory() {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, return empty array
      return [];
    }
  }

  /**
   * Save response history to file
   * @param {Array} history - Array of response history entries
   */
  async saveHistory(history) {
    try {
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('❌ Failed to save response history:', error.message);
      throw new Error(`Failed to save response history: ${error.message}`);
    }
  }

  /**
   * Add a new response generation to history
   * @param {Object} emailData - Original email data
   * @param {string} userInstruction - User's instruction
   * @param {Array} suggestions - AI-generated suggestions
   * @param {Object} analysis - AI analysis of the email
   * @param {Object} metadata - Generation metadata
   * @returns {Object} History entry
   */
  async addResponseHistory(emailData, userInstruction, suggestions, analysis, metadata) {
    try {
      const history = await this.loadHistory();
      
      const historyEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        email: {
          from: emailData.from,
          subject: emailData.subject,
          date: emailData.date,
          threadId: emailData.threadId
        },
        userInstruction,
        suggestions: suggestions.map(suggestion => ({
          ...suggestion,
          selected: false // Track which one was selected
        })),
        analysis,
        metadata: {
          ...metadata,
          historyId: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        status: 'generated' // generated, selected, saved_to_draft
      };

      // Add to beginning of history
      history.unshift(historyEntry);

      // Keep only the most recent entries
      if (history.length > this.maxHistorySize) {
        history.splice(this.maxHistorySize);
      }

      await this.saveHistory(history);
      
      console.log(`📚 Added response to history: ${historyEntry.id}`);
      return historyEntry;

    } catch (error) {
      console.error('❌ Failed to add response history:', error.message);
      throw new Error(`Failed to add response history: ${error.message}`);
    }
  }

  /**
   * Mark a suggestion as selected
   * @param {string} historyId - History entry ID
   * @param {string} suggestionId - Suggestion ID
   * @returns {Object} Updated history entry
   */
  async markSuggestionSelected(historyId, suggestionId) {
    try {
      const history = await this.loadHistory();
      const entry = history.find(h => h.id === historyId);
      
      if (!entry) {
        throw new Error(`History entry not found: ${historyId}`);
      }

      // Mark the selected suggestion
      entry.suggestions.forEach(suggestion => {
        suggestion.selected = (suggestion.id === suggestionId);
      });

      entry.status = 'selected';
      entry.selectedAt = new Date().toISOString();

      await this.saveHistory(history);
      
      console.log(`✅ Marked suggestion as selected: ${suggestionId}`);
      return entry;

    } catch (error) {
      console.error('❌ Failed to mark suggestion as selected:', error.message);
      throw new Error(`Failed to mark suggestion as selected: ${error.message}`);
    }
  }

  /**
   * Mark response as saved to draft
   * @param {string} historyId - History entry ID
   * @param {string} draftId - Gmail draft ID
   * @returns {Object} Updated history entry
   */
  async markSavedToDraft(historyId, draftId) {
    try {
      const history = await this.loadHistory();
      const entry = history.find(h => h.id === historyId);
      
      if (!entry) {
        throw new Error(`History entry not found: ${historyId}`);
      }

      entry.status = 'saved_to_draft';
      entry.savedToDraftAt = new Date().toISOString();
      entry.draftId = draftId;

      await this.saveHistory(history);
      
      console.log(`📝 Marked as saved to draft: ${draftId}`);
      return entry;

    } catch (error) {
      console.error('❌ Failed to mark as saved to draft:', error.message);
      throw new Error(`Failed to mark as saved to draft: ${error.message}`);
    }
  }

  /**
   * Get response history with filtering options
   * @param {Object} options - Filter options
   * @returns {Array} Filtered history entries
   */
  async getResponseHistory(options = {}) {
    try {
      const history = await this.loadHistory();
      
      let filteredHistory = history;

      // Filter by status
      if (options.status) {
        filteredHistory = filteredHistory.filter(entry => entry.status === options.status);
      }

      // Filter by date range
      if (options.startDate) {
        filteredHistory = filteredHistory.filter(entry => 
          new Date(entry.timestamp) >= new Date(options.startDate)
        );
      }

      if (options.endDate) {
        filteredHistory = filteredHistory.filter(entry => 
          new Date(entry.timestamp) <= new Date(options.endDate)
        );
      }

      // Filter by email sender
      if (options.sender) {
        filteredHistory = filteredHistory.filter(entry => 
          entry.email.from.toLowerCase().includes(options.sender.toLowerCase())
        );
      }

      // Limit results
      const limit = options.limit || 20;
      filteredHistory = filteredHistory.slice(0, limit);

      return {
        success: true,
        count: filteredHistory.length,
        total: history.length,
        entries: filteredHistory
      };

    } catch (error) {
      console.error('❌ Failed to get response history:', error.message);
      throw new Error(`Failed to get response history: ${error.message}`);
    }
  }

  /**
   * Get a specific history entry
   * @param {string} historyId - History entry ID
   * @returns {Object} History entry
   */
  async getHistoryEntry(historyId) {
    try {
      const history = await this.loadHistory();
      const entry = history.find(h => h.id === historyId);
      
      if (!entry) {
        throw new Error(`History entry not found: ${historyId}`);
      }

      return {
        success: true,
        entry
      };

    } catch (error) {
      console.error('❌ Failed to get history entry:', error.message);
      throw new Error(`Failed to get history entry: ${error.message}`);
    }
  }

  /**
   * Get user preferences based on history
   * @returns {Object} User preferences analysis
   */
  async getUserPreferences() {
    try {
      const history = await this.loadHistory();
      
      // Analyze user preferences
      const preferences = {
        totalGenerations: history.length,
        selectedResponses: history.filter(h => h.status === 'selected').length,
        savedToDraft: history.filter(h => h.status === 'saved_to_draft').length,
        preferredTones: {},
        preferredTypes: {},
        averageResponseLength: 0,
        mostActiveSenders: {},
        generationFrequency: {}
      };

      // Analyze tone preferences
      history.forEach(entry => {
        if (entry.status === 'selected' || entry.status === 'saved_to_draft') {
          const selectedSuggestion = entry.suggestions.find(s => s.selected);
          if (selectedSuggestion) {
            preferences.preferredTones[selectedSuggestion.tone] = 
              (preferences.preferredTones[selectedSuggestion.tone] || 0) + 1;
            preferences.preferredTypes[selectedSuggestion.type] = 
              (preferences.preferredTypes[selectedSuggestion.type] || 0) + 1;
          }
        }
      });

      // Analyze sender activity
      history.forEach(entry => {
        const sender = entry.email.from;
        preferences.mostActiveSenders[sender] = 
          (preferences.mostActiveSenders[sender] || 0) + 1;
      });

      // Calculate average response length
      const selectedResponses = history
        .filter(h => h.status === 'selected' || h.status === 'saved_to_draft')
        .map(h => h.suggestions.find(s => s.selected))
        .filter(Boolean);

      if (selectedResponses.length > 0) {
        const totalLength = selectedResponses.reduce((sum, suggestion) => 
          sum + (suggestion.text ? suggestion.text.length : 0), 0);
        preferences.averageResponseLength = Math.round(totalLength / selectedResponses.length);
      }

      return {
        success: true,
        preferences
      };

    } catch (error) {
      console.error('❌ Failed to analyze user preferences:', error.message);
      throw new Error(`Failed to analyze user preferences: ${error.message}`);
    }
  }

  /**
   * Clear response history
   * @param {Object} options - Clear options
   */
  async clearHistory(options = {}) {
    try {
      if (options.all) {
        // Clear all history
        await this.saveHistory([]);
        console.log('🗑️ Cleared all response history');
      } else {
        // Clear old entries (keep last 10)
        const history = await this.loadHistory();
        const recentHistory = history.slice(0, 10);
        await this.saveHistory(recentHistory);
        console.log('🗑️ Cleared old response history (kept last 10)');
      }

      return {
        success: true,
        message: options.all ? 'All history cleared' : 'Old history cleared'
      };

    } catch (error) {
      console.error('❌ Failed to clear history:', error.message);
      throw new Error(`Failed to clear history: ${error.message}`);
    }
  }

  /**
   * Test the history service with sample data
   */
  async testWithSampleData() {
    try {
      console.log('🧪 Testing Response History Service...');
      
      // Add sample history entry
      const sampleEmail = {
        from: 'Sarah Johnson <sarah@company.com>',
        subject: 'Project Meeting Next Week',
        date: '2025-01-20',
        threadId: 'thread_123'
      };

      const sampleSuggestions = [
        {
          id: 'sug_1',
          type: 'accept',
          text: 'Yes, I can join the meeting. What is the agenda?',
          emoji: '✅',
          tone: 'professional'
        },
        {
          id: 'sug_2',
          type: 'decline',
          text: 'Sorry, I am not available for that time.',
          emoji: '❌',
          tone: 'professional'
        },
        {
          id: 'sug_3',
          type: 'modify',
          text: 'Can we discuss the agenda first?',
          emoji: '🔄',
          tone: 'professional'
        }
      ];

      const sampleAnalysis = {
        emailType: 'meeting_invitation',
        urgency: 'medium',
        tone: 'professional',
        keyPoints: ['Tuesday 2pm', 'project meeting']
      };

      const sampleMetadata = {
        model: 'gpt-4o-mini',
        tokensUsed: 550,
        cost: '0.0825'
      };

      // Add to history
      const historyEntry = await this.addResponseHistory(
        sampleEmail,
        'I want to accept but ask for the agenda',
        sampleSuggestions,
        sampleAnalysis,
        sampleMetadata
      );

      console.log('✅ Sample history entry added:', historyEntry.id);

      // Get history
      const history = await this.getResponseHistory({ limit: 5 });
      console.log(`📚 Retrieved ${history.count} history entries`);

      // Get user preferences
      const preferences = await this.getUserPreferences();
      console.log('📊 User preferences analyzed');

      return {
        success: true,
        message: 'Response history service test completed',
        historyEntry,
        historyCount: history.count,
        preferences: preferences.preferences
      };

    } catch (error) {
      console.error('❌ History service test failed:', error.message);
      throw new Error(`History service test failed: ${error.message}`);
    }
  }
}

module.exports = ResponseHistoryService;
