# 🐍 Python App Running Guide

Complete guide to set up and run the Smart Email Manager Python FastAPI server.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Gmail API Setup](#gmail-api-setup)
5. [Running the Server](#running-the-server)
6. [Verifying Installation](#verifying-installation)
7. [Troubleshooting](#troubleshooting)
8. [Development Tips](#development-tips)

---

## Prerequisites

Before you begin, ensure you have:

### Required Software

- **Python 3.8+** (Python 3.13 recommended)
  ```bash
  python3 --version  # Should show 3.8 or higher
  ```
  
- **pip** (Python package manager)
  ```bash
  pip3 --version
  ```

- **Git** (if cloning from repository)
  ```bash
  git --version
  ```

### Required Accounts & API Keys

- **OpenAI API Key** - For AI responses and embeddings
  - Get one at: https://platform.openai.com/api-keys
  
- **Google Cloud Account** - For Gmail API access
  - Create project at: https://console.cloud.google.com
  
- **ChromaDB** (Optional) - For vector database (local or cloud)
  - Free cloud account: https://trychroma.com/
  
- **Hugging Face Token** (Optional) - For TTS models
  - Get one at: https://huggingface.co/settings/tokens

---

## Initial Setup

### Step 1: Navigate to Python Server Directory

```bash
cd smart-email-manager/python-server
```

### Step 2: Create Virtual Environment

**On macOS/Linux:**
```bash
python3 -m venv venv
```

**On Windows:**
```bash
python -m venv venv
```

### Step 3: Activate Virtual Environment

**On macOS/Linux:**
```bash
source venv/bin/activate
```

**On Windows:**
```bash
venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt.

### Step 4: Install Dependencies

```bash
pip install -r requirements.txt
```

This will install all required packages:
- FastAPI & Uvicorn (web framework)
- OpenAI SDK (AI integration)
- Google API Client (Gmail)
- ChromaDB (vector database)
- LangChain (AI orchestration)
- Transformers (TTS models)
- And more...

**Note:** First-time installation may take 5-10 minutes depending on your internet connection.

---

## Environment Configuration

### Step 1: Create `.env` File

Copy the template file:
```bash
# From python-server directory
cp ../env-template.txt .env
```

**Or manually create `.env` in the `python-server/` directory**

### Step 2: Configure Environment Variables

Open `.env` and fill in your values:

#### Required Settings:

```bash
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPEN_API_KEY_FOR_TEXT_EMBEDDING=sk-your-embedding-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Server Configuration
MCP_PORT=3000
NODE_ENV=development
```

#### Optional Settings:

```bash
# ChromaDB Configuration (Choose one: local or cloud)

# Option 1: ChromaDB Cloud (Recommended for production)
CHROMA_USE_LOCAL=false
CHROMA_CLOUD_URL=https://api.trychroma.com
CHROMA_API_KEY=your-chroma-api-key-here
CHROMA_TENANT=default-tenant
CHROMA_DATABASE=default_database
CHROMA_COLLECTION_NAME=email-embeddings

# Option 2: Local ChromaDB (For development)
CHROMA_USE_LOCAL=true
CHROMA_PATH=./chroma_data

# Email Configuration
MAX_EMAILS=300
SYNC_INTERVAL=300000

# Response Generation
MAX_RESPONSE_TOKENS=500

# Hugging Face (Optional - for TTS)
HF_TOKEN=hf_your-huggingface-token-here
HUGGINGFACE_API_KEY=hf_your-huggingface-token-here

# TTS Configuration
TTS_MODEL=suno/bark-small
TTS_CACHE_DIR=./summary_tts_cache
TTS_MAX_TEXT_LENGTH=500
```

### Step 3: Verify `.env` File Location

The `.env` file should be in one of these locations:
1. `python-server/.env` (preferred)
2. Project root `smart-email-manager/.env` (fallback)

The app will check both locations automatically.

---

## Gmail API Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name it: "Smart Email Manager"
4. Click "Create"

### Step 2: Enable Gmail API

1. In the search bar, type "Gmail API"
2. Click "Gmail API"
3. Click "Enable"

### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure consent screen:
   - User Type: External
   - App name: Smart Email Manager
   - Your email
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add test users: YOUR email
   - Save
4. Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: Smart Email Manager Desktop
   - Click "Create"
5. Download the JSON file
6. **Rename it to `credentials.json`**
7. **Move it to `python-server/server/credentials.json`**

### Step 4: Directory Structure

Ensure your directory structure looks like:
```
python-server/
├── server/
│   ├── credentials.json  ← Your Gmail OAuth credentials
│   └── token.json       ← Will be created after first auth
├── .env                 ← Your environment variables
├── venv/                ← Virtual environment
└── ...
```

---

## Running the Server

### Method 1: Using the Startup Script (Recommended)

**On macOS/Linux:**
```bash
# Make sure script is executable
chmod +x start-server.sh

# Run the script
./start-server.sh
```

**On Windows:**
```bash
# Double-click start-server.bat
# Or run in terminal:
start-server.bat
```

The script will:
- ✅ Check for virtual environment (create if missing)
- ✅ Activate the virtual environment
- ✅ Install dependencies if needed
- ✅ Check for `.env` file
- ✅ Start the FastAPI server

### Method 2: Manual Startup

**Step 1: Activate Virtual Environment**

**On macOS/Linux:**
```bash
source venv/bin/activate
```

**On Windows:**
```bash
venv\Scripts\activate
```

**Step 2: Run the Server**

```bash
# From python-server directory
python main.py
```

**Or using uvicorn directly:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

### Server Output

You should see:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:3000 (Press CTRL+C to quit)
```

### Server URLs

Once running, access:

- **API Server:** http://localhost:3000
- **API Documentation (Swagger):** http://localhost:3000/docs
- **Alternative Docs (ReDoc):** http://localhost:3000/redoc
- **Web App:** http://localhost:3000 (serves files from `web-app/`)

---

## Verifying Installation

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Smart Email Manager API"
}
```

### Test 2: API Documentation

Open in browser: http://localhost:3000/docs

You should see the interactive API documentation with all available endpoints.

### Test 3: Gmail Connection

First-time setup will open a browser window for Gmail authentication:
1. Select your Google account
2. Click "Continue" (you may see a warning - normal for development)
3. Allow access to Gmail

After authentication, `python-server/server/token.json` will be created.

### Test 4: Fetch Emails

Using the API docs at http://localhost:3000/docs:
1. Navigate to `/api/gmail/emails` endpoint
2. Click "Try it out"
3. Click "Execute"
4. You should see your emails!

---

## Troubleshooting

### Issue: "Virtual environment not found"

**Solution:**
```bash
cd python-server
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

### Issue: "Module not found" or Import Errors

**Solution:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # macOS/Linux

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: "No .env file found"

**Solution:**
```bash
# Copy template
cp ../env-template.txt .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

### Issue: "credentials.json not found"

**Solution:**
1. Verify file location: `python-server/server/credentials.json`
2. Make sure you downloaded OAuth credentials from Google Cloud Console
3. Ensure file is named exactly `credentials.json` (not `client_secret.json`)
4. For Desktop app type, not Web application type

### Issue: "Port 3000 already in use"

**Solution:**

**Option 1:** Change port in `.env`:
```bash
MCP_PORT=3001
```

**Option 2:** Stop other service using port 3000:
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process (replace PID with actual process ID)
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Issue: "Gmail authentication failed"

**Solution:**
1. Delete `python-server/server/token.json`
2. Restart the server
3. Try Gmail endpoint again
4. Browser will open for re-authentication

### Issue: "OpenAI API key invalid"

**Solution:**
1. Check `.env` file has correct `OPENAI_API_KEY`
2. Verify key starts with `sk-`
3. Test key at https://platform.openai.com/api-keys
4. Ensure no extra spaces or quotes around the key

### Issue: "ChromaDB connection failed"

**Solution:**

**For Cloud ChromaDB:**
1. Verify `CHROMA_API_KEY` is correct
2. Check `CHROMA_CLOUD_URL` is correct
3. Ensure tenant/database names are correct

**For Local ChromaDB:**
1. Set `CHROMA_USE_LOCAL=true` in `.env`
2. ChromaDB will create local database automatically

### Issue: Python version incompatible

**Solution:**
```bash
# Check Python version
python3 --version  # Should be 3.8+

# If you have multiple Python versions:
python3.11 -m venv venv  # Use specific version
```

### Issue: Installation takes too long

**Solution:**
- Some packages (like `torch`) are large and take time to download
- Be patient, first install can take 5-10 minutes
- Consider using faster internet connection
- Try installing without cache: `pip install --no-cache-dir -r requirements.txt`

---

## Development Tips

### Hot Reload

The server runs with `--reload` flag by default, so code changes automatically restart the server.

### Debugging

To see detailed logs:
```bash
# Set logging level in .env
NODE_ENV=development

# Or run with verbose output
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload --log-level debug
```

### Testing Different Configurations

Create multiple `.env` files:
```bash
.env.development
.env.production
.env.test
```

Switch between them by copying:
```bash
cp .env.development .env
```

### Running on Different Port

Edit `.env`:
```bash
MCP_PORT=3100
```

Or override on command line:
```bash
MCP_PORT=3100 python main.py
```

### Checking Dependencies

```bash
# List installed packages
pip list

# Check for outdated packages
pip list --outdated

# Update requirements.txt
pip freeze > requirements.txt
```

### Virtual Environment Management

**Deactivate:**
```bash
deactivate
```

**Delete and recreate:**
```bash
deactivate
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### IDE Setup (Optional)

For better development experience, configure your IDE:
- **VS Code:** Python extension + FastAPI extension
- **PyCharm:** Configure interpreter to use `venv`

---

## Quick Reference

### Essential Commands

```bash
# Setup (first time only)
cd python-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../env-template.txt .env
# Edit .env with your keys

# Daily usage
cd python-server
./start-server.sh
# OR
source venv/bin/activate
python main.py

# Stop server
Press Ctrl+C
```

### File Locations

```
python-server/
├── .env                    ← Your configuration
├── server/
│   ├── credentials.json   ← Gmail OAuth (you download)
│   └── token.json         ← Auto-generated after auth
├── venv/                   ← Virtual environment
├── requirements.txt        ← Dependencies list
└── main.py                 ← Server entry point
```

### Important URLs

- Server: http://localhost:3000
- API Docs: http://localhost:3000/docs
- Health Check: http://localhost:3000/health

---

## Next Steps

Once your server is running:

1. ✅ Test Gmail connection
2. ✅ Fetch your first emails
3. ✅ Try semantic search
4. ✅ Generate AI responses
5. ✅ Test the web interface at http://localhost:3000

---

## Need Help?

### Check These Files:
- `README.md` - Project overview
- `QUICK-START.md` - Quick setup guide
- `00-COMPLETE-SETUP.md` - Complete setup documentation
- `python-server/README.md` - Python server specifics

### Common Resources:
- FastAPI Docs: https://fastapi.tiangolo.com/
- Gmail API: https://developers.google.com/gmail/api
- OpenAI API: https://platform.openai.com/docs
- ChromaDB: https://docs.trychroma.com/

---

**Happy coding! 🚀**

If you encounter issues not covered here, check the logs in your terminal or browser console for detailed error messages.

