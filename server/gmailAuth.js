const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose'
];
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

/**
 * Create a Gmail draft
 * @param {Object} draftData - Draft data containing to, subject, body
 * @param {string} threadId - Optional thread ID to reply to
 * @returns {Object} Created draft
 */
async function createGmailDraft(draftData, threadId = null) {
  try {
    const gmail = await getGmailClient();
    
    // Build the email message
    const { to, subject, body } = draftData;
    
    // Create the email message in RFC 2822 format
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');
    
    // Encode the message in base64url
    const encodedMessage = Buffer.from(message).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Prepare draft data
    const draftPayload = {
      message: {
        raw: encodedMessage
      }
    };
    
    // Add thread ID if replying to existing email
    if (threadId) {
      draftPayload.message.threadId = threadId;
    }
    
    // Create the draft
    const response = await gmail.users.drafts.create({
      userId: 'me',
      resource: draftPayload
    });
    
    return {
      success: true,
      draftId: response.data.id,
      messageId: response.data.message.id,
      threadId: response.data.message.threadId,
      snippet: response.data.message.snippet
    };
    
  } catch (error) {
    console.error('❌ Gmail draft creation error:', error.message);
    throw new Error(`Failed to create Gmail draft: ${error.message}`);
  }
}

module.exports = { getGmailClient, createGmailDraft };


