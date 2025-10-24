# Smart Email Manager - Suggested Commands

## Development Commands

### Project Setup
```bash
# Install all dependencies
npm run setup

# Install root dependencies only
npm install

# Install server dependencies only
cd server && npm install
```

### Server Development
```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm run server

# Start server manually
cd server && node index.js

# Start server with start script (Mac/Linux)
./start-server.sh

# Start server with start script (Windows)
start-server.bat
```

### Testing Commands
```bash
# Test server health
curl http://localhost:3000/health

# Test Gmail connection
curl http://localhost:3000/test-gmail

# Fetch recent emails
curl "http://localhost:3000/emails?max=5"

# Test semantic search
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "meetings about budget", "limit": 10}'

# Get ChromaDB stats
curl http://localhost:3000/stats
```

## Environment Setup

### Create Environment File
```bash
# Copy template to .env
cp env-template.txt .env

# Edit .env file (add your API keys)
nano .env  # or use your preferred editor
```

### Gmail API Setup
```bash
# Download Gmail API credentials
# 1. Go to https://console.cloud.google.com
# 2. Create project "Smart Email Manager"
# 3. Enable Gmail API
# 4. Create OAuth credentials (Desktop app)
# 5. Download JSON file
# 6. Rename to credentials.json
# 7. Place in server/credentials.json
```

## Development Workflow

### Daily Development
```bash
# Start development server
npm run dev

# In another terminal, test endpoints
curl http://localhost:3000/health

# Check server logs for errors
# Server will auto-reload on file changes
```

### Testing Gmail Integration
```bash
# Test Gmail connection
curl http://localhost:3000/test-gmail

# If first time, browser will open for OAuth
# Grant permissions, then test again

# Fetch some emails
curl "http://localhost:3000/emails?max=10"
```

### Testing Semantic Search
```bash
# First, sync emails to create embeddings
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"maxEmails": 50}'

# Then test search
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "meetings", "limit": 5}'
```

## Chrome Extension Development

### Load Extension in Chrome
```bash
# 1. Open Chrome
# 2. Go to chrome://extensions/
# 3. Enable "Developer mode"
# 4. Click "Load unpacked"
# 5. Select the extension/ folder
```

### Extension Development
```bash
# Make changes to extension files
# Reload extension in Chrome
# Test functionality
```

## Debugging Commands

### Server Debugging
```bash
# Check server logs
# Server logs will show in terminal where you started it

# Check if port is in use
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process on port 3000
kill -9 $(lsof -t -i:3000)  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### Gmail API Debugging
```bash
# Check if credentials.json exists
ls -la server/credentials.json

# Check if token.json exists (created after first auth)
ls -la server/token.json

# Delete token to force re-authentication
rm server/token.json
```

### ChromaDB Debugging
```bash
# Check if ChromaDB data exists
ls -la server/chroma_data/

# Reset ChromaDB data
rm -rf server/chroma_data/

# Check ChromaDB stats
curl http://localhost:3000/stats
```

## Production Commands

### Build for Production
```bash
# Install production dependencies
npm install --production

# Start production server
NODE_ENV=production npm run server
```

### Environment Variables
```bash
# Set production environment
export NODE_ENV=production

# Set custom port
export MCP_PORT=8080

# Set OpenAI API key
export OPENAI_API_KEY=sk-your-key-here
```

## Utility Commands

### File Operations
```bash
# Create backup of ChromaDB data
cp -r server/chroma_data/ server/chroma_data_backup/

# Reset project (delete all data)
rm -rf server/chroma_data/
rm server/token.json

# Check project structure
tree -I node_modules
```

### Git Commands
```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit"

# Check status
git status

# View logs
git log --oneline
```

## API Testing with curl

### Health Check
```bash
curl http://localhost:3000/health
```

### Gmail Test
```bash
curl http://localhost:3000/test-gmail
```

### Fetch Emails
```bash
# Get 5 recent emails
curl "http://localhost:3000/emails?max=5"

# Get 20 recent emails
curl "http://localhost:3000/emails?max=20"
```

### Sync Emails
```bash
# Sync 50 emails
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"maxEmails": 50}'

# Sync 100 emails
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"maxEmails": 100}'
```

### Semantic Search
```bash
# Search for meetings
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "meetings", "limit": 10}'

# Search for budget discussions
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "budget discussions", "limit": 5}'

# Search for emails from specific person
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "emails from john", "limit": 10}'
```

### Get Statistics
```bash
# Get ChromaDB stats
curl http://localhost:3000/stats
```

## Troubleshooting Commands

### Check Dependencies
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check installed packages
npm list

# Check for outdated packages
npm outdated
```

### Check Environment
```bash
# Check if .env file exists
ls -la .env

# Check environment variables
cat .env

# Check if credentials.json exists
ls -la server/credentials.json
```

### Reset Everything
```bash
# Stop server (Ctrl+C)
# Delete all data
rm -rf server/chroma_data/
rm server/token.json

# Restart server
npm run dev
```

## Development Tips

### Use These Commands Regularly
1. `npm run dev` - Start development server
2. `curl http://localhost:3000/health` - Test server
3. `curl http://localhost:3000/test-gmail` - Test Gmail
4. `curl "http://localhost:3000/emails?max=5"` - Test email fetching

### Monitor Server Logs
- Server logs show in terminal
- Look for ✅ success messages
- Look for ❌ error messages
- Check for API rate limits

### Test Incrementally
- Test each endpoint individually
- Start with health check
- Then test Gmail connection
- Then test email fetching
- Then test search functionality