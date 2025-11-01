# Phase 1 – Node.js Contract Inventory

Smart Email Manager currently runs on an Express server (`server/index.js`) that exposes REST endpoints consumed by the SPA in `web-app/app.js`. This document captures the request/response contracts, supporting services, and configuration that the upcoming Python implementation must preserve.

## Server Overview

- **Base URL:** `http://localhost:3000`
- **Static Assets:** `GET /` serves `web-app/index.html`; other static files are in `web-app/`.
- **Middleware:** `cors`, `express.json`, environment loading via `dotenv`.
- **Shared Services:**
  - `gmailAuth.js` – Gmail OAuth2, `getGmailClient()`, `createGmailDraft()`.
  - `emailService.js` – message parsing, HTML-to-text, importance heuristics.
  - `embeddingService.js` – OpenAI embeddings (`generateEmbedding`, `generateEmailEmbeddings`).
  - `vectorStore.js` – ChromaDB client management, `addEmails`, `searchEmails`, `getStats`.
  - `aiResponseService.js` – Chat Completions for smart replies and summaries.
  - `toneAdjustmentService.js` – tone rewriting, analysis, and batch adjustment.
  - `responseHistoryService.js` – local JSON persistence for AI response history.

## Endpoint Contracts

| Method & Route | Purpose | Request | Success Response | Error Response |
| --- | --- | --- | --- | --- |
| `GET /health` | Health check | – | `{ success: true, status, message, timestamp }` | `500`, `{ success: false, error }` |
| `GET /test-gmail` | Validate Gmail OAuth credentials | – | Gmail profile info `{ success, emailAddress, totalMessages, threadsTotal }` | `500`, `{ success: false, error, hint }` |
| `GET /emails` | Fetch recent Gmail messages | Query: `max` (default 10) | `{ success, count, emails: [{ id, subject, from, date, snippet }] }` | `500`, `{ success: false, error }` |
| `POST /sync` | Fetch Gmail messages, compute embeddings, upsert into ChromaDB | Body unused (currently hard-coded to 200 emails) | `{ success: true, indexed, message }` | `500`, `{ success: false, error, hint }` |
| `POST /search` | Semantic search against Chroma | `{ query: string, limit?: number }` | `{ success, query, count, results: [{ rank, id, subject, from, date, snippet, similarity, distance, threadId }] }` | `400` when missing query; otherwise `500`, `{ success: false, error, hint }` |
| `POST /generate-response` | Smart reply suggestions | `{ emailData, userInstruction, options? }` where `emailData` includes `subject`, `from`, `date`, `content/snippet/body`, etc. | `{ success: true, suggestions: [{ type, text, emoji }], analysis, metadata }` | `400` for missing fields; `500`, `{ success: false, error, hint }` |
| `POST /save-draft` | Save AI reply to Gmail draft | `{ emailId, responseText, tone? }` | `{ success: true, message, draft: { id, snippet }, metadata: { recipient, subject, savedAt } }` | `400` for missing fields; `500`, `{ success: false, error, hint }` |
| `GET /response-history` | List stored AI responses | Query: `status`, `limit`, `startDate`, `endDate`, `sender` | `{ success, stats, success: true, count, total, entries }` (stats contains `emailsIndexed`, `aiResponses`, `timeSaved`) | `500`, `{ success: false, error }` |
| `GET /response-history/:historyId` | Retrieve single history entry | URL param `historyId` | `{ success: true, entry }` | `404`, `{ success: false, error }` |
| `POST /response-history/:historyId/select` | Mark suggestion as selected | URL param `historyId`; body `{ suggestionId }` | `{ success: true, message, entry }` | `400` when missing `suggestionId`; `500`, `{ success: false, error }` |
| `POST /response-history/:historyId/saved-to-draft` | Mark entry as saved to Gmail draft | URL param `historyId`; body `{ draftId }` | `{ success: true, message, entry }` | `400` / `500` as above |
| `DELETE /response-history` | Clear history | Query: `all` (`true` clears all else keeps last 10) | `{ success: true, message }` | `500`, `{ success: false, error }` |
| `GET /test-history` | Run history service smoke test | – | `{ success: true, message, historyEntry, historyCount, preferences }` | `500`, `{ success: false, error, hint }` |
| `POST /adjust-tone` | Rewrite a response in target tone | `{ response, targetTone, options? }` | `{ success: true, originalResponse, adjustedResponse, targetTone, metadata }` | `400` / `500` with hint |
| `GET /tone-options` | List tone presets | – | `{ success: true, toneOptions: [{ value, label, description, example }] }` | `500`, `{ success: false, error }` |
| `POST /analyze-tone` | Analyse response tone | `{ response }` | `{ success: true, analysis: { primaryTone, confidence, characteristics, suggestions }, metadata }` | `400` / `500` |
| `POST /batch-adjust-tone` | Multi-response tone adjustment | `{ responses: Array<{ id?, text }>, targetTone }` | `{ success: true, adjustedResponses, targetTone, count }` | `400` / `500` |
| `GET /test-tone` | Tone service smoke test | – | `{ success: true, message, originalResponse, adjustedResponse, targetTone, metadata }` | `500`, `{ success: false, error, hint }` |
| `GET /test-ai` | AI reply service smoke test | – | `{ success: true, message, ... }` | `500`, `{ success: false, error, hint }` |
| `GET /stats` | ChromaDB statistics | – | `{ success: true, totalEmails, collectionName, ready }` | `500`, `{ success: false, error }` |
| `POST /summarize-email` | Generate TTS-friendly email summary | `{ emailId, emailData }` | `{ success: true, summary, metadata, emailId, emailSubject }` | `400` / `500`, `{ success: false, error, hint }` |

## Data & Service Notes

- **Email Objects:** typically contain `id`, `threadId`, `subject`, `from`, `date`, `snippet`, optional `content/body`, `labels`, `important`. Python services must accept and emit the same shape.
- **Embeddings:** use OpenAI `text-embedding-3-small` via `OPEN_API_KEY_FOR_TEXT_EMBEDDING`; vectors are arrays of 1,536 floats.
- **Vector Store:** Chroma collection defaults to `email-embeddings`; metadata fields include `subject`, `from`, `to`, `date`, `threadId`, `snippet`, `labels`, `important`.
- **Response History Records:** persisted as JSON (`response-history.json`) with status lifecycle `generated → selected → saved_to_draft`; suggestions include `emoji`, `type`, `text`, `selected`.
- **Tone Options:** fixed palette (`very formal`, `formal`, `professional`, `casual`, etc.) with descriptions/exemplars.

## Environment Variables

The Node server reads configuration from `.env`. Critical keys to mirror in Python:

- **OpenAI:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL`, `MAX_RESPONSE_TOKENS`.
- **Embeddings:** `OPEN_API_KEY_FOR_TEXT_EMBEDDING`, `EMBEDDING_MODEL` (optional).
- **ChromaDB:** `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE`, `CHROMA_COLLECTION_NAME`, `CHROMA_USE_LOCAL`.
- **Server:** `MCP_PORT`, `NODE_ENV`.
- **Email Sync:** `MAX_EMAILS`, `SYNC_INTERVAL`.
- **Third Party:** `HUGGINGFACE_API_KEY`.

All new Python modules should load the same variables (names unchanged) to avoid client-side adjustments.

## Frontend Touchpoints

- `web-app/app.js` sets `apiBaseUrl = 'http://localhost:3000'` and consumes the endpoints listed above.
- Response payload shapes (e.g., `results`, `suggestions`, `stats`) are tightly coupled to UI rendering; altering field names will require frontend changes.
- TTS and summary panels expect `/summarize-email` to return `{ summary, metadata }`.
- History and stats widgets rely on `/response-history` defaulting to `limit=20` and returning `stats`.

---
**Deliverable:** This document fulfills Phase 1 of the migration plan by freezing the observable behaviour of the Node.js API. Subsequent phases will replicate these contracts in the Python FastAPI service without breaking the existing frontend.

