# Smart Email Manager - Technical Context

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Authentication**: OAuth 2.0 with Google Cloud
- **Email API**: Gmail API v1
- **AI Integration**: OpenAI API (GPT-4 + text-embedding-3-small)
- **Vector Database**: ChromaDB (local or cloud)
- **Environment**: dotenv for configuration

### Frontend
- **Platform**: Chrome Extension (Manifest V3)
- **Architecture**: Popup UI + Background Service Worker
- **Communication**: Message passing between popup and background
- **API Calls**: HTTP requests to MCP server

### Dependencies (Root)
```json
{
  "name": "smart-email-manager",
  "version": "1.0.0",
  "scripts": {
    "server": "cd server && node index.js",
    "dev": "cd server && nodemon index.js",
    "setup": "npm install && cd server && npm install"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

### Dependencies (Server)
```json
{
  "dependencies": {
    "@google-cloud/local-auth": "^3.0.1",
    "chromadb": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "googleapis": "^130.0.0",
    "openai": "^4.28.0"
  }
}
```

## Development Environment
- **OS**: Cross-platform (Windows, macOS, Linux)
- **Node.js**: 18.0.0 or higher
- **Package Manager**: npm
- **Editor**: VS Code recommended
- **Browser**: Chrome for extension development

## Configuration Files
- **Environment**: `.env` (from `env-template.txt`)
- **Gmail Credentials**: `server/credentials.json`
- **Chrome Extension**: `extension/manifest.json`

## API Endpoints
- `GET /health` - Server health check
- `GET /test-gmail` - Test Gmail connection
- `GET /emails?max=10` - Fetch recent emails
- `POST /sync` - Index emails for search
- `POST /search` - Semantic email search
- `GET /stats` - ChromaDB statistics

## Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4-turbo-preview
EMBEDDING_MODEL=text-embedding-3-small

# ChromaDB Configuration
CHROMA_USE_LOCAL=false
CHROMA_CLOUD_URL=https://api.trychroma.com
CHROMA_API_KEY=your-chroma-api-key-here
CHROMA_TENANT=default-tenant
CHROMA_DATABASE=default_database
CHROMA_COLLECTION_NAME=email-embeddings

# Server Configuration
MCP_PORT=3000
NODE_ENV=development
```

## File Structure
```
smart-email-manager/
├── server/                    # Backend MCP server
│   ├── index.js              # Express server
│   ├── gmailAuth.js          # Gmail OAuth
│   ├── emailService.js       # Email parsing
│   ├── embeddingService.js   # Vector embeddings
│   ├── vectorStore.js        # ChromaDB operations
│   └── package.json          # Server dependencies
├── extension/                # Chrome extension (to be built)
├── package.json              # Root package config
├── .env                      # Environment variables
└── env-template.txt          # Environment template
```

## Development Commands
```bash
# Install dependencies
npm run setup

# Start development server
npm run dev

# Start production server
npm run server

# Test server
npm test
```

## External Services
- **Google Cloud Console**: Gmail API setup
- **OpenAI Platform**: API keys and usage
- **ChromaDB Cloud**: Vector database (optional)