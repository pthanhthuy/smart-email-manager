//
//  toneAdjustmentService.js
//  Smart Email Manager
//
//  Created by AI Assistant on 20/1/25.
//  Copyright © 2025 Smart Email Manager. All rights reserved.
//

const OpenAI = require('openai');

class ToneAdjustmentService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Adjust the tone of a response
   * @param {string} originalResponse - The original response text
   * @param {string} targetTone - The desired tone (formal, casual, professional, friendly, etc.)
   * @param {Object} options - Adjustment options
   * @returns {Object} Adjusted response
   */
  async adjustTone(originalResponse, targetTone, options = {}) {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🎨 TONE ADJUSTMENT');
      console.log('='.repeat(60));
      console.log(`📝 Original: "${originalResponse}"`);
      console.log(`🎯 Target Tone: ${targetTone}`);
      console.log('='.repeat(60) + '\n');

      // Build the tone adjustment prompt
      const prompt = this.buildToneAdjustmentPrompt(originalResponse, targetTone, options);

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at adjusting email tone. Rewrite responses to match the desired tone while keeping the same meaning and intent.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const adjustedResponse = response.choices[0].message.content.trim();

      console.log('✅ Tone adjustment completed!');
      console.log(`📊 Tokens used: ${response.usage.total_tokens}`);
      console.log(`💰 Estimated cost: $${(response.usage.total_tokens * 0.00015).toFixed(4)}`);
      console.log(`🎨 Adjusted: "${adjustedResponse}"\n`);

      return {
        success: true,
        originalResponse,
        adjustedResponse,
        targetTone,
        metadata: {
          model: options.model || 'gpt-4o-mini',
          tokensUsed: response.usage.total_tokens,
          cost: (response.usage.total_tokens * 0.00015).toFixed(4),
          processingTime: Date.now()
        }
      };

    } catch (error) {
      console.error('❌ Tone adjustment error:', error.message);
      throw new Error(`Tone adjustment failed: ${error.message}`);
    }
  }

  /**
   * Build the tone adjustment prompt
   */
  buildToneAdjustmentPrompt(originalResponse, targetTone, options) {
    const toneDescriptions = {
      'very formal': 'very formal and professional, using formal language and structure',
      'formal': 'formal and professional, maintaining business etiquette',
      'professional': 'professional but approachable, business-appropriate',
      'casual': 'casual and friendly, conversational but still professional',
      'very casual': 'very casual and relaxed, like talking to a friend',
      'friendly': 'warm and friendly, approachable and personable',
      'apologetic': 'apologetic and understanding, showing empathy',
      'urgent': 'urgent and direct, conveying importance',
      'diplomatic': 'diplomatic and tactful, carefully worded',
      'enthusiastic': 'enthusiastic and positive, showing excitement'
    };

    const toneDescription = toneDescriptions[targetTone.toLowerCase()] || targetTone;

    return `Rewrite this email response to be ${toneDescription}.

ORIGINAL RESPONSE:
"${originalResponse}"

REQUIREMENTS:
- Keep the same meaning and intent
- Maintain the same length (approximately)
- Use the target tone: ${targetTone}
- Make it sound natural and human-like
- Preserve any important details or questions

OUTPUT FORMAT:
Just provide the rewritten response, nothing else.

REWRITTEN RESPONSE:`;
  }

  /**
   * Get available tone options
   * @returns {Array} Available tone options
   */
  getAvailableTones() {
    return [
      {
        value: 'very formal',
        label: 'Very Formal',
        description: 'Very formal and professional, using formal language and structure',
        example: 'Dear [Name], I would be pleased to attend the meeting...'
      },
      {
        value: 'formal',
        label: 'Formal',
        description: 'Formal and professional, maintaining business etiquette',
        example: 'Hello [Name], I can attend the meeting...'
      },
      {
        value: 'professional',
        label: 'Professional',
        description: 'Professional but approachable, business-appropriate',
        example: 'Hi [Name], I\'d be happy to join the meeting...'
      },
      {
        value: 'casual',
        label: 'Casual',
        description: 'Casual and friendly, conversational but still professional',
        example: 'Hey [Name], I can make it to the meeting...'
      },
      {
        value: 'very casual',
        label: 'Very Casual',
        description: 'Very casual and relaxed, like talking to a friend',
        example: 'Hey! Tuesday works great for me!'
      },
      {
        value: 'friendly',
        label: 'Friendly',
        description: 'Warm and friendly, approachable and personable',
        example: 'Hi [Name]! I\'d love to join the meeting...'
      },
      {
        value: 'apologetic',
        label: 'Apologetic',
        description: 'Apologetic and understanding, showing empathy',
        example: 'I\'m sorry, but I won\'t be able to attend...'
      },
      {
        value: 'urgent',
        label: 'Urgent',
        description: 'Urgent and direct, conveying importance',
        example: 'This is urgent - we need to discuss this immediately...'
      },
      {
        value: 'diplomatic',
        label: 'Diplomatic',
        description: 'Diplomatic and tactful, carefully worded',
        example: 'I appreciate the invitation, however...'
      },
      {
        value: 'enthusiastic',
        label: 'Enthusiastic',
        description: 'Enthusiastic and positive, showing excitement',
        example: 'Absolutely! I\'m excited to join the meeting!'
      }
    ];
  }

  /**
   * Analyze the tone of a response
   * @param {string} response - The response to analyze
   * @returns {Object} Tone analysis
   */
  async analyzeTone(response) {
    try {
      const prompt = `Analyze the tone of this email response and provide a detailed analysis.

RESPONSE:
"${response}"

Please analyze and provide:
1. Primary tone (formal, casual, professional, etc.)
2. Confidence level (0-100)
3. Key characteristics
4. Suggested improvements

OUTPUT FORMAT (JSON):
{
  "primaryTone": "professional",
  "confidence": 85,
  "characteristics": ["polite", "direct", "business-appropriate"],
  "suggestions": ["Could be more casual", "Consider adding enthusiasm"]
}`;

      const aiResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing email tone. Provide accurate tone analysis in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const content = aiResponse.choices[0].message.content.trim();
      // Extract JSON from the response (handle cases where AI includes markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const analysis = JSON.parse(jsonStr);

      return {
        success: true,
        analysis,
        metadata: {
          tokensUsed: aiResponse.usage.total_tokens,
          cost: (aiResponse.usage.total_tokens * 0.00015).toFixed(4)
        }
      };

    } catch (error) {
      console.error('❌ Tone analysis error:', error.message);
      throw new Error(`Tone analysis failed: ${error.message}`);
    }
  }

  /**
   * Batch adjust multiple responses
   * @param {Array} responses - Array of responses to adjust
   * @param {string} targetTone - Target tone for all responses
   * @returns {Array} Adjusted responses
   */
  async batchAdjustTone(responses, targetTone) {
    try {
      console.log(`🎨 Batch adjusting ${responses.length} responses to ${targetTone} tone`);
      
      const adjustedResponses = [];
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        console.log(`   Adjusting ${i + 1}/${responses.length}: "${response.text}"`);
        
        const adjusted = await this.adjustTone(response.text, targetTone);
        adjustedResponses.push({
          ...response,
          text: adjusted.adjustedResponse,
          originalText: response.text,
          toneAdjusted: true,
          targetTone
        });
      }

      return {
        success: true,
        adjustedResponses,
        targetTone,
        count: adjustedResponses.length
      };

    } catch (error) {
      console.error('❌ Batch tone adjustment error:', error.message);
      throw new Error(`Batch tone adjustment failed: ${error.message}`);
    }
  }

  /**
   * Test the tone adjustment service with sample data
   */
  async testWithSampleData() {
    try {
      console.log('🧪 Testing Tone Adjustment Service...');
      
      const sampleResponse = "Hi Sarah, Tuesday at 2pm works great for me!";
      const targetTone = "very casual";
      
      console.log(`📝 Sample: "${sampleResponse}"`);
      console.log(`🎯 Target: ${targetTone}`);
      
      const result = await this.adjustTone(sampleResponse, targetTone);
      
      console.log('✅ Tone adjustment test completed');
      console.log(`📊 Tokens used: ${result.metadata.tokensUsed}`);
      console.log(`💰 Cost: $${result.metadata.cost}`);
      
      return {
        success: true,
        message: 'Tone adjustment service test completed',
        originalResponse: sampleResponse,
        adjustedResponse: result.adjustedResponse,
        targetTone,
        metadata: result.metadata
      };

    } catch (error) {
      console.error('❌ Tone adjustment test failed:', error.message);
      throw new Error(`Tone adjustment test failed: ${error.message}`);
    }
  }
}

module.exports = ToneAdjustmentService;
