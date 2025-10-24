# Smart Email Manager - System Patterns

## Architecture Patterns

### 1. MCP (Model Context Protocol) Server Pattern
- **Purpose**: Backend server that handles AI operations and external API calls
- **Implementation**: Express.js server with specific endpoints for email operations
- **Benefits**: Separation of concerns, scalable, can be used by multiple clients

### 2. Chrome Extension Architecture
```
Popup UI (User Interface)
    ↓ message passing
Background Service Worker (API Communication)
    ↓ HTTP requests
MCP Server (Business Logic)
    ↓ API calls
External Services (Gmail, OpenAI, ChromaDB)
```

### 3. Vector Embedding Pipeline
```
Email Text → OpenAI Embeddings API → Vector (1536 dimensions) → ChromaDB Storage
Query Text → OpenAI Embeddings API → Vector → ChromaDB Search → Similar Emails
```

## Code Organization Patterns

### 1. Service Layer Pattern
Each major functionality is separated into its own service:
- `gmailAuth.js` - Gmail authentication and client management
- `emailService.js` - Email parsing and text extraction
- `embeddingService.js` - Vector embedding generation
- `vectorStore.js` - ChromaDB operations and search

### 2. Error Handling Pattern
```javascript
try {
  // Operation
  const result = await someOperation();
  console.log('✅ Success message');
  return result;
} catch (error) {
  console.error('❌ Error message:', error.message);
  throw error;
}
```

### 3. Async/Await Pattern
All API calls use async/await for clean asynchronous code:
```javascript
async function processEmails() {
  const gmail = await getGmailClient();
  const emails = await fetchEmails(gmail);
  const embeddings = await generateEmbeddings(emails);
  return embeddings;
}
```

## Data Flow Patterns

### 1. Email Processing Flow
```
Gmail API → Raw Email Data → Parse Headers/Body → Clean Text → Generate Embedding → Store in ChromaDB
```

### 2. Search Flow
```
User Query → Generate Query Embedding → Search ChromaDB → Rank by Similarity → Return Results
```

### 3. Response Generation Flow
```
Selected Email → Extract Context → Craft Prompt → Call GPT-4 → Return Draft Response
```

## Security Patterns

### 1. OAuth 2.0 Flow
- No password storage
- Token-based authentication
- Automatic token refresh
- Secure credential management

### 2. Environment Variable Pattern
- Sensitive data in `.env` file
- Template file for easy setup
- Git-ignored sensitive files
- Clear separation of config and code

### 3. API Key Management
- Separate keys for different services
- Environment-based configuration
- No hardcoded credentials

## Performance Patterns

### 1. Batch Processing
- Process multiple emails in batches
- Batch embedding generation
- Efficient ChromaDB operations

### 2. Caching Strategy
- Store embeddings to avoid regeneration
- Persistent ChromaDB storage
- Token caching for OAuth

### 3. Error Recovery
- Graceful degradation
- Retry mechanisms
- Fallback strategies

## UI/UX Patterns

### 1. Chrome Extension Communication
```javascript
// Popup to Background
chrome.runtime.sendMessage({action: 'searchEmails', query: 'meetings'});

// Background to Popup
chrome.runtime.sendMessage({type: 'searchResults', data: results});
```

### 2. Loading States
- Show loading indicators during API calls
- Progress feedback for long operations
- Error states with helpful messages

### 3. User Feedback
- Success/error notifications
- Clear status messages
- Helpful error descriptions

## Testing Patterns

### 1. Health Check Endpoints
- `/health` for server status
- `/test-gmail` for Gmail connectivity
- `/stats` for ChromaDB status

### 2. Error Response Format
```javascript
{
  success: false,
  error: 'Error message',
  hint: 'Helpful suggestion'
}
```

### 3. Success Response Format
```javascript
{
  success: true,
  data: result,
  message: 'Success message'
}
```

## Deployment Patterns

### 1. Environment Configuration
- Development vs production settings
- Local vs cloud database options
- Configurable ports and URLs

### 2. Script Organization
- Start scripts for different platforms
- Setup scripts for dependencies
- Development vs production commands

### 3. Documentation Pattern
- Comprehensive README files
- Step-by-step setup guides
- Troubleshooting sections
- Learning resources