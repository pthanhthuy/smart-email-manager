//
//  aiResponseService.js
//  Smart Email Manager
//
//  Created by AI Assistant on 20/1/25.
//  Copyright © 2025 Smart Email Manager. All rights reserved.
//

const OpenAI = require('openai');
const ResponseHistoryService = require('./responseHistoryService');

class AIResponseService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.historyService = new ResponseHistoryService();
  }

  /**
   * Generate smart reply suggestions for an email
   * Feature 1: Smart Reply Suggestions
   * 
   * @param {Object} emailData - The email to respond to
   * @param {string} userInstruction - What the user wants to communicate
   * @param {Object} options - Configuration options
   * @returns {Object} AI-generated response suggestions
   */
  async generateSmartReplies(emailData, userInstruction, options = {}) {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🤖 AI RESPONSE GENERATION');
      console.log('='.repeat(60));
      console.log(`📧 Email: ${emailData.subject}`);
      console.log(`💬 User intent: ${userInstruction}`);
      console.log('='.repeat(60) + '\n');

      // Build the AI prompt
      const prompt = this.buildSmartReplyPrompt(emailData, userInstruction, options);

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent email assistant. Generate quick, professional reply suggestions for emails. Keep responses under 10 words each and make them natural and human-like.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      // Parse the response
      const aiResponse = response.choices[0].message.content;
      const parsedResponse = this.parseAIResponse(aiResponse);

      console.log('✅ AI response generated successfully!');
      console.log(`📊 Tokens used: ${response.usage.total_tokens}`);
      console.log(`💰 Estimated cost: $${(response.usage.total_tokens * 0.00015).toFixed(4)}\n`);

      const metadata = {
        model: options.model || 'gpt-4o-mini',
        tokensUsed: response.usage.total_tokens,
        cost: (response.usage.total_tokens * 0.00015).toFixed(4),
        processingTime: Date.now()
      };

      // Save to response history (Feature 3)
      try {
        const historyEntry = await this.historyService.addResponseHistory(
          emailData,
          userInstruction,
          parsedResponse.suggestions,
          parsedResponse.analysis,
          metadata
        );
        console.log(`📚 Added to response history: ${historyEntry.id}`);
        metadata.historyId = historyEntry.id;
      } catch (error) {
        console.warn('⚠️ Failed to save to history:', error.message);
        // Continue without failing the main request
      }

      return {
        success: true,
        suggestions: parsedResponse.suggestions,
        analysis: parsedResponse.analysis,
        metadata
      };

    } catch (error) {
      console.error('❌ AI response generation error:', error.message);
      throw new Error(`AI response generation failed: ${error.message}`);
    }
  }

  /**
   * Build the AI prompt for smart reply suggestions
   */
  buildSmartReplyPrompt(emailData, userInstruction, options) {
    const { from, subject, content, date } = emailData;
    
    return `Analyze this email and suggest 3 quick reply options based on the user's intent.

EMAIL TO ANALYZE:
---
From: ${from}
Subject: ${subject}
Date: ${date}
Content: ${content}
---

USER'S INTENT: "${userInstruction}"

TASK:
Generate 3 quick reply suggestions (each under 10 words):
1. ACCEPT - If user wants to accept/confirm
2. DECLINE - If user wants to decline/say no  
3. MODIFY - If user wants to suggest changes/alternatives

REQUIREMENTS:
- Keep each suggestion under 10 words
- Make them natural and conversational
- Match the email's tone (formal/casual)
- Be specific to the email content
- Use the user's intent

OUTPUT FORMAT (JSON):
{
  "suggestions": [
    {
      "type": "accept",
      "text": "Yes, I can join the meeting",
      "emoji": "✅"
    },
    {
      "type": "decline", 
      "text": "Sorry, I'm not available",
      "emoji": "❌"
    },
    {
      "type": "modify",
      "text": "Can we do 3pm instead?",
      "emoji": "🔄"
    }
  ],
  "analysis": {
    "emailType": "meeting_invitation",
    "urgency": "medium",
    "tone": "professional",
    "keyPoints": ["Tuesday 2pm", "project meeting"]
  }
}`;
  }

  /**
   * Parse the AI response and extract suggestions
   */
  parseAIResponse(aiResponse) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return parsed;
      }

      // Fallback: parse manually if JSON extraction fails
      return this.parseManualResponse(aiResponse);
    } catch (error) {
      console.warn('⚠️ Failed to parse AI response as JSON, using fallback');
      return this.parseManualResponse(aiResponse);
    }
  }

  /**
   * Fallback parser for non-JSON responses
   */
  parseManualResponse(aiResponse) {
    const lines = aiResponse.split('\n').filter(line => line.trim());
    const suggestions = [];
    
    // Look for numbered suggestions
    lines.forEach(line => {
      if (line.match(/^\d+\./)) {
        const text = line.replace(/^\d+\.\s*/, '').trim();
        if (text) {
          suggestions.push({
            type: suggestions.length === 0 ? 'accept' : suggestions.length === 1 ? 'decline' : 'modify',
            text: text,
            emoji: suggestions.length === 0 ? '✅' : suggestions.length === 1 ? '❌' : '🔄'
          });
        }
      }
    });

    return {
      suggestions: suggestions.length > 0 ? suggestions : [
        { type: 'accept', text: 'Yes, I can help', emoji: '✅' },
        { type: 'decline', text: 'Sorry, not available', emoji: '❌' },
        { type: 'modify', text: 'Can we discuss this?', emoji: '🔄' }
      ],
      analysis: {
        emailType: 'general',
        urgency: 'medium',
        tone: 'professional',
        keyPoints: []
      }
    };
  }

  /**
   * Generate detailed response options (Feature 2 - for future implementation)
   */
  async generateDetailedResponses(emailData, userInstruction, options = {}) {
    // This will be implemented in Feature 2
    throw new Error('Detailed responses not implemented yet. Use generateSmartReplies for quick suggestions.');
  }

  /**
   * Test the AI service with a sample email
   */
  async testWithSampleEmail() {
    const sampleEmail = {
      from: 'Sarah Johnson <sarah@company.com>',
      subject: 'Project Meeting Next Week',
      content: 'Hi! I\'m organizing a project sync meeting for next Tuesday at 2pm. Can you join us? We\'ll discuss the Q4 roadmap. Let me know!',
      date: '2025-01-20'
    };

    const userInstruction = 'I\'m available and want to join';
    
    console.log('🧪 Testing AI service with sample email...');
    return await this.generateSmartReplies(sampleEmail, userInstruction);
  }
}

module.exports = AIResponseService;
