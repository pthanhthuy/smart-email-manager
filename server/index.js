const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { getGmailClient } = require('./gmailAuth');
const { parseEmail } = require('./emailService');
const { generateEmailEmbeddings, generateEmbedding } = require('./embeddingService');
const { addEmails, searchEmails, getStats } = require('./vectorStore');

const app = express();
const PORT = process.env.MCP_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
  console.log(`   GET  /stats            - ChromaDB statistics`);
  console.log('='.repeat(50) + '\n');
  console.log('💡 Quick Start:');
  console.log('   1. Test: http://localhost:${PORT}/test-gmail');
  console.log('   2. Sync: POST /sync {"maxEmails": 50}');
  console.log('   3. Search: POST /search {"query": "budget meetings"}');
  console.log('✨ Ready to receive requests!\n');
});


