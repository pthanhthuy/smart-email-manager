# Smart Email Manager - Project Brief

## Project Overview
**Smart Email Manager** is an AI-powered email assistant that provides semantic search and smart response generation for Gmail. It's designed as a Chrome extension with a Node.js backend that uses vector embeddings to understand email meaning rather than just keywords.

## Core Purpose
- **Semantic Search**: Find emails by meaning, not just keywords (e.g., "emails about meetings" finds "conference call", "team sync", etc.)
- **Smart Response Generation**: AI-powered draft creation with multiple tone options
- **Important Email Detection**: AI scores email importance and prioritizes VIP senders

## Target Users
- Busy professionals who need to quickly find relevant emails
- Users who want AI assistance in crafting email responses
- People who want to leverage modern AI techniques for email management

## Key Features
1. **Gmail Integration**: OAuth 2.0 authentication with Gmail API
2. **Vector Embeddings**: Convert emails to 1536-dimensional vectors using OpenAI
3. **Semantic Search**: Find emails by meaning using cosine similarity
4. **AI Response Generation**: GPT-4 powered email draft creation
5. **Chrome Extension**: User-friendly interface for email management

## Technical Architecture
- **Frontend**: Chrome Extension (Manifest V3)
- **Backend**: Node.js + Express (MCP Server)
- **AI**: OpenAI (GPT-4 + Embeddings)
- **Email**: Gmail API
- **Vector Search**: ChromaDB (local) or ChromaDB Cloud
- **Authentication**: OAuth 2.0

## Business Value
- Saves time on email management
- Improves email search accuracy
- Provides AI assistance for responses
- Monetization potential: $29-99/month for busy professionals
- Low operational costs (~$2/user/month)

## Success Metrics
- Gmail API integration working
- Semantic search finding relevant emails
- AI responses being useful and accurate
- Chrome extension providing good UX
- Users finding value in daily usage