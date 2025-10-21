# ✅ Setup Complete - Next Steps

## 🎉 Great Work! You're Ready to Build!

Since you've completed the Chroma Cloud setup, let's move on to building your first server!

---

## 📋 Quick Checklist

### ✅ What You Should Have Done:
- ✅ ChromaDB installed (`npm install` - done!)
- ✅ Chroma Cloud account created
- ✅ Chroma API key obtained
- ✅ API key added to `.env` file

### ⏳ What We'll Do Next:
1. Set up Gmail API (10 minutes)
2. Create authentication file (5 minutes)
3. Create basic server (10 minutes)
4. Test fetching emails! (5 minutes)

**Total time: ~30 minutes to working code!** 🚀

---

## 🎯 Step-by-Step: Gmail API Setup

### Step 1: Create Google Cloud Project (3 minutes)

1. Go to: **https://console.cloud.google.com**
2. Sign in with your Gmail account
3. Click the project dropdown (top left, near "Google Cloud")
4. Click "**New Project**"
5. Name it: `Smart Email Manager`
6. Click "**Create**"
7. Wait ~30 seconds for project creation

---

### Step 2: Enable Gmail API (2 minutes)

1. In the search bar at top, type: `Gmail API`
2. Click on "**Gmail API**" in the results
3. Click the blue "**Enable**" button
4. Wait for it to enable (takes a few seconds)
5. You'll see "API enabled" ✅

---

### Step 3: Configure OAuth Consent Screen (3 minutes)

1. In the left sidebar, click "**OAuth consent screen**"
2. Select "**External**" (unless you have a workspace)
3. Click "**Create**"

4. Fill in required fields:
   - **App name:** `Smart Email Manager`
   - **User support email:** Your email
   - **Developer contact:** Your email
   
5. Click "**Save and Continue**"

6. On "Scopes" page:
   - Click "**Add or Remove Scopes**"
   - Search for: `gmail.readonly`
   - Check the box for `https://www.googleapis.com/auth/gmail.readonly`
   - Click "**Update**"
   - Click "**Save and Continue**"

7. On "Test users" page:
   - Click "**Add Users**"
   - Add YOUR email address
   - Click "**Add**"
   - Click "**Save and Continue**"

8. Click "**Back to Dashboard**"

---

### Step 4: Create OAuth Credentials (2 minutes)

1. In left sidebar, click "**Credentials**"
2. Click "**+ Create Credentials**" at top
3. Select "**OAuth client ID**"
4. Application type: Select "**Desktop app**"
5. Name: `Smart Email Manager Desktop`
6. Click "**Create**"

7. A dialog appears with your client ID
8. Click "**Download JSON**"
9. The file downloads (named something like `client_secret_xxx.json`)

---

### Step 5: Save Credentials File (1 minute)

1. Find the downloaded JSON file
2. **Rename it to:** `credentials.json`
3. **Move it to:** `smart-email-manager/mcp-server/credentials.json`

**Important:** This file should be in the `mcp-server` folder!

---

## 💻 Create Your First Server Files

### File 1: Gmail Authentication (`mcp-server/gmailAuth.js`)

Create this file with the following code:

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

---

### File 2: Basic Server (`mcp-server/index.js`)

Create this file with the following code:

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

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Smart Email Manager Server');
  console.log('='.repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📧 Test Gmail: http://localhost:${PORT}/test-gmail`);
  console.log(`📬 Get emails: http://localhost:${PORT}/emails?max=5`);
  console.log('='.repeat(50) + '\n');
  console.log('💡 Tip: First request will open browser for Gmail authentication');
  console.log('✨ Ready to receive requests!\n');
});
```

---

## 🚀 Test Your Server!

### Step 1: Start the Server

```bash
cd mcp-server
node index.js
```

You should see:
```
==================================================
🚀 Smart Email Manager Server
==================================================
📡 Server running on: http://localhost:3000
📧 Test Gmail: http://localhost:3000/test-gmail
📬 Get emails: http://localhost:3000/emails?max=5
==================================================
```

---

### Step 2: Test Gmail Connection

Open your browser and go to:
```
http://localhost:3000/test-gmail
```

**First time only:**
1. A browser window will open automatically
2. Select your Google account
3. You'll see a warning "Google hasn't verified this app"
4. Click "**Continue**" (it's your app, it's safe!)
5. Click "**Allow**" to grant Gmail access
6. The browser will show "Authentication successful!"

**You should see:**
```json
{
  "success": true,
  "message": "Gmail connected!",
  "emailAddress": "your@email.com",
  "totalMessages": 1234
}
```

🎉 **Success! Gmail is connected!**

---

### Step 3: Fetch Your Emails

In your browser:
```
http://localhost:3000/emails?max=5
```

You should see your 5 most recent emails! 🎉

---

## ✅ Success Checklist

After completing these steps, you should have:

- ✅ Google Cloud project created
- ✅ Gmail API enabled
- ✅ OAuth credentials downloaded
- ✅ `credentials.json` in `mcp-server/` folder
- ✅ `gmailAuth.js` created
- ✅ `index.js` created
- ✅ Server running on port 3000
- ✅ Gmail authentication working
- ✅ Can fetch emails via API

**You now have a working server that can access Gmail!** 🚀

---

## 🎯 What's Next?

Now that your server can fetch emails, the next steps are:

### Phase 1: Add Vector Search (Next!)
1. Create `embeddingService.js` - Generate embeddings
2. Create `vectorStore.js` - Connect to Chroma Cloud
3. Create `/sync` endpoint - Index your emails
4. Create `/search` endpoint - Semantic search!

### Phase 2: Add AI Features
1. Create `responseGenerator.js` - AI drafts
2. Add `/generate-response` endpoint
3. Add `/create-draft` endpoint

### Phase 3: Build Chrome Extension
1. Create popup UI
2. Connect to server
3. Display results
4. Complete app!

---

## 🐛 Troubleshooting

### "Cannot find module 'gmailAuth'"
→ Make sure `gmailAuth.js` is in `mcp-server/` folder
→ Check spelling exactly matches

### "credentials.json not found"
→ Download from Google Cloud Console
→ Rename to exactly `credentials.json`
→ Place in `mcp-server/` folder (not root!)

### "Error: invalid_client"
→ Make sure you created "Desktop app" credentials
→ Re-download if needed

### "Access blocked"
→ Go back to OAuth consent screen
→ Add your email as test user
→ This is normal during development!

### Server won't start
→ Make sure port 3000 is not in use
→ Check .env has `MCP_PORT=3000`

---

## 📖 Files You Should Have Now

```
smart-email-manager/
├── .env                          ✅ Your API keys
├── mcp-server/
│   ├── node_modules/             ✅ Dependencies
│   ├── package.json              ✅ Config
│   ├── credentials.json          ✅ Gmail OAuth (NEW!)
│   ├── gmailAuth.js              ✅ Gmail auth (NEW!)
│   ├── index.js                  ✅ Server (NEW!)
│   └── token.json                ⏳ Auto-created on first auth
└── Documentation files...
```

---

## 🎉 Celebrate!

You just:
- ✅ Set up Chroma Cloud
- ✅ Set up Gmail API
- ✅ Created authentication
- ✅ Built a working server
- ✅ Fetched real emails!

**You're ~40% done with the project!** 🎊

---

## 🚀 Continue Learning

Your progress:
```
[✅ Setup] → [✅ Gmail] → [⏳ Search] → [⏸️ AI] → [⏸️ Extension]
                           ↑
                    Next: Semantic Search!
```

---

## 💪 Ready for Next Phase?

Once you have emails fetching successfully, you're ready to add:
- **Vector embeddings** (convert emails to vectors)
- **Chroma Cloud storage** (store vectors)
- **Semantic search** (find by meaning!)

**Continue with PROJECT-PLAN.md Phase 3!** 🚀

---

**Great job getting this far! You're building something amazing!** 🌟


