# Quick Start Guide - Smart Email Manager

## 🚀 Get Started in 30 Minutes!

This guide will get you to your first working feature: **fetching emails from Gmail**.

---

## Step 1: Install Dependencies (5 minutes)

```bash
cd smart-email-manager

# Install root dependencies
npm install

# Install server dependencies
cd mcp-server
npm install express cors dotenv googleapis @google-cloud/local-auth
cd ..
```

---

## Step 2: Set Up Gmail API (10 minutes)

### 2.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name it: "Smart Email Manager"
4. Click "Create"

### 2.2 Enable Gmail API
1. In the search bar, type "Gmail API"
2. Click "Gmail API"
3. Click "Enable"

### 2.3 Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure consent screen:
   - User Type: External
   - App name: Smart Email Manager
   - Your email
   - Skip optional fields
   - Add scope: Gmail API (readonly)
   - Add test users: YOUR email
   - Save
4. Create OAuth client ID:
   - Application type: Desktop app
   - Name: Smart Email Manager Desktop
   - Click "Create"
5. Download the JSON file
6. **IMPORTANT**: Rename it to `credentials.json`
7. Move it to `smart-email-manager/mcp-server/credentials.json`

---

## Step 3: Set Up Environment Variables (2 minutes)

```bash
# In smart-email-manager/ directory
cp .env.template .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-key-here
```

Don't have an OpenAI key yet? Get one at: https://platform.openai.com/api-keys

---

## Step 4: Create Your First Server File (10 minutes)

Create `mcp-server/gmailAuth.js`:

```javascript
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * Load or request authorization to call Gmail APIs.
 */
async function authorize() {
  try {
    // Try to load existing token
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    
    const auth = google.auth.fromJSON(credentials);
    return auth;
  } catch (err) {
    // No saved token, need to authenticate
    return await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
  }
}

/**
 * Save credentials to token.json
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Get authenticated Gmail client
 */
async function getGmailClient() {
  const auth = await authorize();
  
  // Save credentials if this is first time
  if (auth.credentials) {
    await saveCredentials(auth);
  }
  
  return google.gmail({ version: 'v1', auth });
}

module.exports = { getGmailClient };
```

Create `mcp-server/index.js`:

```javascript
require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { getGmailClient } = require('./gmailAuth');

const app = express();
const PORT = process.env.MCP_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Email Manager Server' });
});

// Test Gmail connection
app.get('/test-gmail', async (req, res) => {
  try {
    const gmail = await getGmailClient();
    
    // Get user profile to test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    res.json({
      success: true,
      message: 'Gmail connected!',
      emailAddress: profile.data.emailAddress,
      totalMessages: profile.data.messagesTotal,
    });
  } catch (error) {
    console.error('Gmail test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get recent emails
app.get('/emails', async (req, res) => {
  try {
    const gmail = await getGmailClient();
    const maxResults = parseInt(req.query.max) || 10;
    
    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: '-category:promotions -category:social', // Filter spam
    });
    
    const messages = response.data.messages || [];
    
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
    
    res.json({
      success: true,
      count: emails.length,
      emails,
    });
  } catch (error) {
    console.error('Fetch emails error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart Email Manager Server running on http://localhost:${PORT}`);
  console.log(`📧 Test Gmail: http://localhost:${PORT}/test-gmail`);
  console.log(`📬 Get emails: http://localhost:${PORT}/emails?max=5`);
});
```

---

## Step 5: Test It! (3 minutes)

### Start the server:
```bash
cd mcp-server
node index.js
```

You should see:
```
🚀 Smart Email Manager Server running on http://localhost:3000
📧 Test Gmail: http://localhost:3000/test-gmail
📬 Get emails: http://localhost:3000/emails?max=5
```

### Test Gmail connection:
Open in browser: http://localhost:3000/test-gmail

**First time**: A browser window will open for Gmail authentication:
1. Select your Google account
2. Click "Continue" (you may see a warning - this is normal for development)
3. Allow access to Gmail

You should see:
```json
{
  "success": true,
  "message": "Gmail connected!",
  "emailAddress": "your@email.com",
  "totalMessages": 1234
}
```

### Fetch your emails:
Open: http://localhost:3000/emails?max=5

You should see your 5 most recent emails! 🎉

---

## 🎉 Success!

You now have:
- ✅ Gmail API working
- ✅ OAuth authentication
- ✅ Server fetching emails
- ✅ Foundation for semantic search!

---

## 🎯 Next Steps

### Immediate (today):
1. ✅ Celebrate! You did it! 🎉
2. Try fetching more emails: `/emails?max=20`
3. Look at the email data structure
4. Read PROJECT-PLAN.md Phase 3 (Semantic Search)

### This week:
1. Implement semantic search (Phase 3)
2. Build the Chrome extension UI (Phase 6)
3. Connect extension to your server

### Next week:
1. Add AI response generation
2. Polish the UI
3. Start using it daily!

---

## 🐛 Troubleshooting

### "Cannot find module 'googleapis'"
```bash
cd mcp-server
npm install googleapis @google-cloud/local-auth
```

### "credentials.json not found"
- Make sure you downloaded OAuth credentials from Google Cloud Console
- Rename the file to exactly `credentials.json`
- Place it in `mcp-server/credentials.json`

### "Error: invalid_client"
- Your credentials.json might be for wrong application type
- Go back to Google Cloud Console
- Create "Desktop app" credentials (not Web application)

### "Access blocked: Smart Email Manager has not completed the Google verification process"
- This is normal during development!
- Go back to OAuth consent screen
- Add your email as a test user
- You'll be able to use your own app

### Server won't start / Port in use
- Another server might be using port 3000
- Change PORT in .env: `MCP_PORT=3001`

---

## 💡 Understanding What You Built

### Authentication Flow:
1. You run the server
2. First request to Gmail → Opens browser
3. You grant permission
4. Token saved to `token.json`
5. Future requests use the token (no browser needed!)

### Email Fetching:
1. Server requests message IDs from Gmail
2. For each ID, fetch full message details
3. Extract headers (subject, from, date)
4. Return clean JSON to client

### What's Next:
- Convert emails to vector embeddings
- Store in vector database
- Build semantic search
- Add AI response generation!

---

## 📚 Resources

- **PROJECT-PLAN.md**: Complete step-by-step guide
- **Gmail API Docs**: https://developers.google.com/gmail/api
- **OAuth Guide**: https://developers.google.com/identity/protocols/oauth2

---

**Got it working? Great! Now move on to Phase 3 in PROJECT-PLAN.md to add semantic search!** 🚀

**Need help? Check the troubleshooting section or review the PROJECT-PLAN.md for more details.**




