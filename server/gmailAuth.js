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


