# Smart Email Manager 📧

AI-powered email assistant with semantic search and smart response generation.

## 🌟 Features

- **Semantic Search**: Find emails by meaning, not just keywords
  - "emails about meetings" → finds all meeting-related emails
  - "where's my receipt?" → finds purchase confirmations
  
- **Smart Response Generation**: AI-powered draft creation
  - Analyzes email context
  - Generates appropriate responses
  - Multiple tone options (formal, casual, brief)

- **Important Email Detection**: Never miss critical messages
  - AI scores email importance
  - Prioritizes VIP senders
  - Highlights urgent items

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Chrome browser
- Gmail account
- OpenAI API key
- Google Cloud project with Gmail API enabled

### Installation

1. **Clone and Install**
```bash
cd smart-email-manager
npm install
cd mcp-server && npm install
```

2. **Set Up Gmail API**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Download `credentials.json` to `mcp-server/`

3. **Configure Environment**
```bash
cp .env.template .env
# Edit .env and add your OpenAI API key
```

4. **Start MCP Server**
```bash
npm run server
# or double-click start-server.bat (Windows)
```

5. **Load Chrome Extension**
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked → select `extension/` folder

## 📖 Usage

1. Click extension icon in Chrome
2. First time: Authenticate with Gmail
3. Search: "emails about budget" (semantic search!)
4. Select an email → Click "Generate Response"
5. Review and save draft to Gmail

## 🛠️ Technology Stack

- **Frontend**: Chrome Extension (Manifest V3)
- **Backend**: Node.js + Express (MCP Server)
- **AI**: OpenAI (GPT-4 + Embeddings)
- **Email**: Gmail API
- **Vector Search**: hnswlib-node

## 📁 Project Structure

```
smart-email-manager/
├── extension/              # Chrome extension
│   ├── manifest.json
│   ├── popup/             # UI
│   ├── background/        # Service worker
│   └── assets/            # Icons
├── mcp-server/            # Backend server
│   ├── index.js          # Express server
│   ├── gmailAuth.js      # Gmail OAuth
│   ├── emailService.js   # Email operations
│   ├── embeddingService.js # Vector embeddings
│   ├── vectorStore.js    # Semantic search
│   └── responseGenerator.js # AI responses
├── .env                   # Environment variables
└── README.md
```

## 💡 How It Works

### Semantic Search
1. Emails are converted to vector embeddings (numbers)
2. Your search query is also converted to a vector
3. Similar vectors = semantically related emails!
4. Fast nearest neighbor search finds matches

### Smart Responses
1. AI analyzes the original email
2. Understands context and intent
3. Generates appropriate response
4. You review and edit before sending

## 💰 Cost

- Gmail API: FREE (1B requests/day)
- OpenAI Embeddings: ~$0.001 per 100 emails
- OpenAI Responses: ~$0.01 per draft
- Total: Very cheap! (~$5/month for heavy use)

## 🔒 Security

- OAuth 2.0 for Gmail (no password storage)
- API keys in .env (gitignored)
- No data sent to third parties
- All processing on your machine/OpenAI

## 🎯 Roadmap

- [x] Phase 1: Gmail integration
- [x] Phase 2: Semantic search
- [x] Phase 3: Response generation
- [ ] Phase 4: Email categories
- [ ] Phase 5: Smart follow-ups
- [ ] Phase 6: Multi-account support

## 🐛 Troubleshooting

### "Gmail authentication failed"
- Check `credentials.json` is valid
- Verify Gmail API is enabled
- Delete `token.json` and re-authenticate

### "Semantic search not working"
- Ensure embeddings are generated (POST /sync)
- Check OpenAI API key is valid
- Try different search phrases

### "Extension can't connect to server"
- Verify server is running: `npm run server`
- Check server is on http://localhost:3000
- Review CORS settings in server

## 📚 Documentation

- [PROJECT-PLAN.md](./PROJECT-PLAN.md) - Complete build guide
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

## 🤝 Contributing

Built following the step-by-step guide in PROJECT-PLAN.md

## 📄 License

MIT License - Feel free to use and modify!

## 🎉 Acknowledgments

- OpenAI for GPT and embeddings
- Google for Gmail API
- Chrome extension platform

---

**Need help?** Check PROJECT-PLAN.md for detailed step-by-step instructions!

**Ready to build?** Start with Phase 1 in PROJECT-PLAN.md!




