const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { getGmailClient, createGmailDraft } = require('./gmailAuth');
const { parseEmail } = require('./emailService');
const { generateEmailEmbeddings, generateEmbedding } = require('./embeddingService');
const { addEmails, searchEmails, getStats } = require('./vectorStore');
const AIResponseService = require('./aiResponseService');
const ResponseHistoryService = require('./responseHistoryService');
const ToneAdjustmentService = require('./toneAdjustmentService');

const app = express();
const PORT = process.env.MCP_PORT || 3000;

// Initialize AI Response Service
const aiResponseService = new AIResponseService();
const responseHistoryService = new ResponseHistoryService();
const toneAdjustmentService = new ToneAdjustmentService();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from web-app directory
app.use(express.static(path.join(__dirname, '../web-app')));

// Serve the main web app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../web-app/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Smart Email Manager Server',
    timestamp: new Date().toISOString()
  });
});

// Test Gmail connection
app.get('/test-gmail', async (req, res) => {
  try {
    console.log('Testing Gmail connection...');
    const gmail = await getGmailClient();
    
    // Get user profile to test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    console.log('✅ Gmail connected successfully!');
    res.json({
      success: true,
      message: 'Gmail connected!',
      emailAddress: profile.data.emailAddress,
      totalMessages: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal
    });
  } catch (error) {
    console.error('❌ Gmail test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure credentials.json is in mcp-server/ folder'
    });
  }
});

// Get recent emails
app.get('/emails', async (req, res) => {
  try {
    const gmail = await getGmailClient();
    const maxResults = parseInt(req.query.max) || 10;
    
    console.log(`Fetching ${maxResults} emails...`);
    
    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: '-category:promotions -category:social', // Filter spam
    });
    
    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} messages`);
    
    // Get details for each message
    const emailPromises = messages.map(async (message) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      
      const headers = detail.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      return {
        id: message.id,
        subject,
        from,
        date,
        snippet: detail.data.snippet,
      };
    });
    
    const emails = await Promise.all(emailPromises);
    
    console.log('✅ Emails fetched successfully!');
    res.json({
      success: true,
      count: emails.length,
      emails,
    });
  } catch (error) {
    console.error('❌ Fetch emails error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// NEW ENDPOINT #1: Sync/Index emails
// Purpose: Fetch emails, generate embeddings, store in ChromaDB
app.post('/sync', async (req, res) => {
  try {
    const maxEmails = parseInt(req.body.maxEmails) || 100;
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 SYNCING EMAILS');
    console.log('='.repeat(60));
    console.log(`📊 Fetching up to ${maxEmails} emails from Gmail...\n`);

    // Step 1: Fetch emails from Gmail
    const gmail = await getGmailClient();
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxEmails,
      q: '-category:promotions -category:social',
    });
    
    const messages = response.data.messages || [];
    console.log(`📬 Found ${messages.length} emails to process`);

    if (messages.length === 0) {
      return res.json({
        success: true,
        indexed: 0,
        message: 'No emails to sync'
      });
    }

    // Step 2: Get full email details
    console.log('📥 Fetching full email details...');
    const emailPromises = messages.map(async (message) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      return parseEmail(detail.data);
    });
    
    const emails = await Promise.all(emailPromises);
    console.log(`✅ Parsed ${emails.length} emails`);

    // Step 3: Generate embeddings
    const emailsWithEmbeddings = await generateEmailEmbeddings(emails);

    // Step 4: Store in ChromaDB
    const indexed = await addEmails(emailsWithEmbeddings);

    console.log('='.repeat(60));
    console.log(`✅ SYNC COMPLETE! Indexed ${indexed} emails`);
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      indexed,
      message: `Successfully indexed ${indexed} emails!`
    });

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check server logs for details'
    });
  }
});

// NEW ENDPOINT #2: Semantic search
// Purpose: Search emails by meaning (not keywords!)
app.post('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 SEMANTIC SEARCH');
    console.log('='.repeat(60));
    console.log(`Query: "${query}"`);
    console.log(`Limit: ${limit}\n`);

    // Step 1: Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Step 2: Search ChromaDB for similar emails
    const results = await searchEmails(queryEmbedding, limit);

    // Step 3: Format results
    const formattedResults = results.map((result, index) => ({
      rank: index + 1,
      id: result.id,
      subject: result.metadata.subject,
      from: result.metadata.from,
      date: result.metadata.date,
      snippet: result.metadata.snippet,
      similarity: Math.round(result.similarity * 100), // Convert to percentage
      distance: result.distance,
      threadId: result.metadata.threadId
    }));

    console.log('='.repeat(60));
    console.log(`✅ Found ${formattedResults.length} matching emails`);
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      query,
      count: formattedResults.length,
      results: formattedResults
    });

  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure you have run /sync first to index emails'
    });
  }
});

// NEW ENDPOINT #3: AI Response Generation
// Purpose: Generate smart reply suggestions for emails
app.post('/generate-response', async (req, res) => {
  try {
    const { emailData, userInstruction, options = {} } = req.body;

    if (!emailData || !userInstruction) {
      return res.status(400).json({
        success: false,
        error: 'Email data and user instruction are required'
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 AI RESPONSE GENERATION');
    console.log('='.repeat(60));
    console.log(`📧 Email: ${emailData.subject}`);
    console.log(`💬 User intent: ${userInstruction}`);
    console.log('='.repeat(60) + '\n');

    // Generate AI response suggestions
    const result = await aiResponseService.generateSmartReplies(emailData, userInstruction, options);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ AI response generation error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure OPENAI_API_KEY is set in .env file'
    });
  }
});

// NEW ENDPOINT #4: Save AI Response to Gmail Draft
// Purpose: Save selected AI response as Gmail draft
app.post('/save-draft', async (req, res) => {
  try {
    const { emailId, responseText, tone } = req.body;

    if (!emailId || !responseText) {
      return res.status(400).json({
        success: false,
        error: 'emailId and responseText are required'
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('📝 SAVING DRAFT TO GMAIL');
    console.log('='.repeat(60));
    console.log(`📧 Email ID: ${emailId}`);
    console.log(`💬 Response: ${responseText}`);
    console.log(`🎨 Tone: ${tone || 'professional'}`);
    console.log('='.repeat(60) + '\n');

    // For now, we'll create a simple draft
    // In a real implementation, you'd fetch the original email details
    const draftData = {
      to: 'recipient@example.com', // This would be extracted from the original email
      subject: 'Re: Your Email',
      body: responseText
    };

    // Create the draft
    const draftResult = await createGmailDraft(draftData);

    console.log('✅ Draft saved successfully!');
    console.log(`📝 Draft ID: ${draftResult.draftId}`);

    res.json({
      success: true,
      message: 'Draft saved to Gmail successfully!',
      draft: {
        id: draftResult.draftId,
        snippet: responseText.substring(0, 100) + '...'
      },
      metadata: {
        recipient: draftData.to,
        subject: draftData.subject,
        savedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Draft saving error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure Gmail credentials have compose permissions'
    });
  }
});

// NEW ENDPOINT #5: Response History Management
// Purpose: Manage and retrieve response history
app.get('/response-history', async (req, res) => {
  try {
    const { status, limit, startDate, endDate, sender } = req.query;
    
    console.log('\n' + '='.repeat(60));
    console.log('📚 RESPONSE HISTORY REQUEST');
    console.log('='.repeat(60));
    console.log(`Status: ${status || 'all'}`);
    console.log(`Limit: ${limit || 20}`);
    console.log('='.repeat(60) + '\n');

    const options = {
      status,
      limit: limit ? parseInt(limit) : 20,
      startDate,
      endDate,
      sender
    };

    const result = await responseHistoryService.getResponseHistory(options);

    console.log(`✅ Retrieved ${result.count} history entries`);

    // Add stats for the frontend
    const stats = {
      emailsIndexed: result.count || 0,
      aiResponses: result.count || 0,
      timeSaved: Math.round((result.count || 0) * 0.08 * 10) / 10 // Estimate 5 minutes per response
    };

    res.json({
      success: true,
      stats,
      ...result
    });

  } catch (error) {
    console.error('❌ Response history error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific history entry
app.get('/response-history/:historyId', async (req, res) => {
  try {
    const { historyId } = req.params;
    
    console.log(`📚 Getting history entry: ${historyId}`);
    
    const result = await responseHistoryService.getHistoryEntry(historyId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Get history entry error:', error.message);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Mark suggestion as selected
app.post('/response-history/:historyId/select', async (req, res) => {
  try {
    const { historyId } = req.params;
    const { suggestionId } = req.body;

    if (!suggestionId) {
      return res.status(400).json({
        success: false,
        error: 'suggestionId is required'
      });
    }

    console.log(`✅ Marking suggestion as selected: ${suggestionId}`);
    
    const result = await responseHistoryService.markSuggestionSelected(historyId, suggestionId);

    res.json({
      success: true,
      message: 'Suggestion marked as selected',
      entry: result
    });

  } catch (error) {
    console.error('❌ Mark suggestion error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark as saved to draft
app.post('/response-history/:historyId/saved-to-draft', async (req, res) => {
  try {
    const { historyId } = req.params;
    const { draftId } = req.body;

    if (!draftId) {
      return res.status(400).json({
        success: false,
        error: 'draftId is required'
      });
    }

    console.log(`📝 Marking as saved to draft: ${draftId}`);
    
    const result = await responseHistoryService.markSavedToDraft(historyId, draftId);

    res.json({
      success: true,
      message: 'Marked as saved to draft',
      entry: result
    });

  } catch (error) {
    console.error('❌ Mark saved to draft error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user preferences
app.get('/user-preferences', async (req, res) => {
  try {
    console.log('📊 Analyzing user preferences...');
    
    const result = await responseHistoryService.getUserPreferences();

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ User preferences error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear response history
app.delete('/response-history', async (req, res) => {
  try {
    const { all } = req.query;
    
    console.log(`🗑️ Clearing response history (all: ${all === 'true'})`);
    
    const result = await responseHistoryService.clearHistory({ all: all === 'true' });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Clear history error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test response history service
app.get('/test-history', async (req, res) => {
  try {
    console.log('🧪 Testing response history service...');
    const result = await responseHistoryService.testWithSampleData();
    
    res.json({
      success: true,
      message: 'Response history service test completed',
      ...result
    });
  } catch (error) {
    console.error('❌ History test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check response history service configuration'
    });
  }
});

// NEW ENDPOINT #6: Tone Adjustment
// Purpose: Adjust the tone of AI responses
app.post('/adjust-tone', async (req, res) => {
  try {
    const { response, targetTone, options = {} } = req.body;

    if (!response || !targetTone) {
      return res.status(400).json({
        success: false,
        error: 'Response and targetTone are required'
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎨 TONE ADJUSTMENT REQUEST');
    console.log('='.repeat(60));
    console.log(`📝 Response: "${response}"`);
    console.log(`🎯 Target Tone: ${targetTone}`);
    console.log('='.repeat(60) + '\n');

    const result = await toneAdjustmentService.adjustTone(response, targetTone, options);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Tone adjustment error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure OPENAI_API_KEY is set in .env file'
    });
  }
});

// Get available tone options
app.get('/tone-options', async (req, res) => {
  try {
    console.log('🎨 Getting available tone options...');
    
    const toneOptions = toneAdjustmentService.getAvailableTones();

    res.json({
      success: true,
      toneOptions
    });

  } catch (error) {
    console.error('❌ Get tone options error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze the tone of a response
app.post('/analyze-tone', async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        error: 'Response is required'
      });
    }

    console.log(`🎨 Analyzing tone of: "${response}"`);
    
    const result = await toneAdjustmentService.analyzeTone(response);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Tone analysis error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Batch adjust multiple responses
app.post('/batch-adjust-tone', async (req, res) => {
  try {
    const { responses, targetTone } = req.body;

    if (!responses || !Array.isArray(responses) || !targetTone) {
      return res.status(400).json({
        success: false,
        error: 'Responses array and targetTone are required'
      });
    }

    console.log(`🎨 Batch adjusting ${responses.length} responses to ${targetTone} tone`);
    
    const result = await toneAdjustmentService.batchAdjustTone(responses, targetTone);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Batch tone adjustment error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test tone adjustment service
app.get('/test-tone', async (req, res) => {
  try {
    console.log('🧪 Testing tone adjustment service...');
    const result = await toneAdjustmentService.testWithSampleData();
    
    res.json({
      success: true,
      message: 'Tone adjustment service test completed',
      ...result
    });
  } catch (error) {
    console.error('❌ Tone test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check OPENAI_API_KEY in .env file'
    });
  }
});

// Test AI service with sample data
app.get('/test-ai', async (req, res) => {
  try {
    console.log('🧪 Testing AI service...');
    const result = await aiResponseService.testWithSampleEmail();
    
    res.json({
      success: true,
      message: 'AI service test completed',
      ...result
    });
  } catch (error) {
    console.error('❌ AI test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check OPENAI_API_KEY in .env file'
    });
  }
});

// Get ChromaDB stats
app.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Smart Email Manager Server');
  console.log('='.repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log(`   GET  /health           - Server health check`);
  console.log(`   GET  /test-gmail       - Test Gmail connection`);
  console.log(`   GET  /emails?max=5     - Fetch recent emails`);
  console.log(`   POST /sync             - Index emails for search`);
  console.log(`   POST /search           - Semantic email search`);
  console.log(`   POST /generate-response - AI response generation`);
  console.log(`   POST /save-draft       - Save AI response to Gmail draft`);
  console.log(`   GET  /response-history - Get response history`);
  console.log(`   GET  /user-preferences - Get user preferences analysis`);
  console.log(`   POST /adjust-tone      - Adjust response tone`);
  console.log(`   GET  /tone-options    - Get available tone options`);
  console.log(`   POST /analyze-tone    - Analyze response tone`);
  console.log(`   GET  /test-tone       - Test tone adjustment service`);
  console.log(`   GET  /test-history    - Test response history service`);
  console.log(`   GET  /test-ai         - Test AI service`);
  console.log(`   GET  /stats           - ChromaDB statistics`);
  console.log('='.repeat(50) + '\n');
  console.log('💡 Quick Start:');
  console.log('   1. Test: http://localhost:${PORT}/test-gmail');
  console.log('   2. Sync: POST /sync {"maxEmails": 50}');
  console.log('   3. Search: POST /search {"query": "budget meetings"}');
  console.log('   4. AI Test: GET /test-ai');
  console.log('   5. Generate: POST /generate-response');
  console.log('   6. Save Draft: POST /save-draft');
  console.log('   7. History: GET /response-history');
  console.log('   8. Preferences: GET /user-preferences');
  console.log('   9. Tone Options: GET /tone-options');
  console.log('   10. Adjust Tone: POST /adjust-tone');
  console.log('✨ Ready to receive requests!\n');
});


