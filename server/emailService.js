/**
 * FILE #3: Email Service
 * Purpose: Parse and clean email text for processing
 * 
 * What this does:
 * - Extract clean text from Gmail emails
 * - Remove HTML tags
 * - Clean up formatting
 * - Prepare text for embedding
 */

/**
 * Extract plain text from HTML
 * @param {string} html - HTML content
 * @returns {string} - Plain text
 */
function htmlToText(html) {
  if (!html) return '';

  // Remove script and style tags with content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extract email body from Gmail message payload
 * @param {object} payload - Gmail message payload
 * @returns {string} - Email body text
 */
function extractEmailBody(payload) {
  if (!payload) return '';

  let body = '';

  // Check for direct body
  if (payload.body && payload.body.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    body = htmlToText(decoded);
  }

  // Check for multipart (common in emails)
  if (payload.parts) {
    for (const part of payload.parts) {
      // Look for text/plain first
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        body += decoded + '\n';
      }
      // Fallback to text/html
      else if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        body += htmlToText(decoded) + '\n';
      }
      // Recursive for nested parts
      else if (part.parts) {
        body += extractEmailBody(part) + '\n';
      }
    }
  }

  return body.trim();
}

/**
 * Parse a Gmail message into a clean email object
 * @param {object} message - Gmail API message object
 * @returns {object} - Cleaned email object
 */
function parseEmail(message) {
  const headers = message.payload.headers;

  // Extract headers
  const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
  const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
  const to = headers.find(h => h.name === 'To')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';
  const messageId = headers.find(h => h.name === 'Message-ID')?.value || message.id;

  // Extract body
  const body = extractEmailBody(message.payload);

  // Use snippet as fallback if body extraction failed
  const snippet = message.snippet || '';
  const finalBody = body.length > 0 ? body : snippet;

  return {
    id: message.id,
    threadId: message.threadId,
    messageId,
    subject,
    from,
    to,
    date,
    body: finalBody,
    snippet: snippet,
    labels: message.labelIds || [],
    internalDate: message.internalDate
  };
}

/**
 * Clean and normalize email text for embedding
 * @param {object} email - Email object
 * @returns {string} - Clean text ready for embedding
 */
function prepareEmailForEmbedding(email) {
  // Combine subject and body for better context
  const subject = email.subject || 'No subject';
  const body = email.body || email.snippet || '';

  // Combine with clear separation
  let text = `Subject: ${subject}\n\nBody: ${body}`;

  // Truncate if too long (OpenAI has token limits)
  // text-embedding-3-small supports up to 8191 tokens (~6000 words)
  const maxLength = 6000 * 5; // Approximate 6000 words * 5 chars per word
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
    console.log(`⚠️ Email truncated (was ${text.length} chars, now ${maxLength})`);
  }

  return text;
}

/**
 * Extract sender email address from "Name <email@domain.com>" format
 * @param {string} from - From header
 * @returns {string} - Email address
 */
function extractEmailAddress(from) {
  if (!from) return '';

  const match = from.match(/<(.+?)>/);
  if (match) {
    return match[1];
  }

  // If no angle brackets, assume whole string is email
  return from.trim();
}

/**
 * Extract sender name from "Name <email@domain.com>" format
 * @param {string} from - From header
 * @returns {string} - Name or email if no name
 */
function extractSenderName(from) {
  if (!from) return 'Unknown';

  const match = from.match(/^(.+?)\s*</);
  if (match) {
    return match[1].replace(/^["']|["']$/g, '').trim();
  }

  // If no name, return email
  return extractEmailAddress(from);
}

/**
 * Format date for display
 * @param {string} dateString - Date string from email
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    return dateString;
  }
}

/**
 * Check if email is important based on heuristics
 * @param {object} email - Email object
 * @returns {boolean} - True if likely important
 */
function isImportant(email) {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();

  // Check for urgency keywords
  const urgentKeywords = [
    'urgent', 'asap', 'important', 'critical', 'deadline',
    'action required', 'immediate', 'emergency'
  ];

  for (const keyword of urgentKeywords) {
    if (subject.includes(keyword)) {
      return true;
    }
  }

  // Check labels
  if (email.labels && email.labels.includes('IMPORTANT')) {
    return true;
  }

  return false;
}

module.exports = {
  htmlToText,
  extractEmailBody,
  parseEmail,
  prepareEmailForEmbedding,
  extractEmailAddress,
  extractSenderName,
  formatDate,
  isImportant
};

