# Phase 2 – Python Architecture & Technology Choices

This document records the technical decisions and planned structure for the Python implementation that will replace the existing Node.js server. The goal is to ensure feature parity while adopting Python-native tooling.

## Framework & Runtime

- **Web Framework:** [FastAPI](https://fastapi.tiangolo.com/) – async-first, OpenAPI generation, easy dependency injection.
- **Server Runner:** `uvicorn[standard]` – ASGI server used for both development (`--reload`) and production (with proper workers).
- **Python Version:** 3.11+ recommended to leverage modern typing and performance improvements.
- **Environment Management:** `python-dotenv` to mirror `.env` handling from the Node server.

## Core Dependencies

| Purpose | Python Package | Notes |
| --- | --- | --- |
| API framework | `fastapi` | Primary HTTP interface |
| ASGI server | `uvicorn[standard]` | Development & deployment server |
| Gmail integration | `google-api-python-client`, `google-auth-oauthlib` | Mirrors `gmailAuth.js` functionality |
| OpenAI access | `openai` | Chat completions, embeddings, tone adjustments |
| Vector store | `chromadb` | Same provider as Node version |
| Data validation | `pydantic` (bundled with FastAPI) | Request/response schemas |
| Background tasks | FastAPI `BackgroundTasks` | For sync/index jobs |
| Utilities | `httpx` (optional) | For outbound HTTP if needed |

Dependencies will be captured in `python-server/requirements.txt` in Phase 3 when implementation begins.

## Module Layout

```
python-server/
├── app/
│   ├── api/
│   │   └── routes/           # Router modules per feature (emails, search, ai, tone, history, stats)
│   ├── core/
│   │   ├── config.py         # Settings loader using pydantic BaseSettings
│   │   └── logging.py        # Structured logging helpers
│   ├── services/
│   │   ├── gmail.py          # Gmail client wrapper (OAuth, drafts)
│   │   ├── emails.py         # Email parsing/cleanup utilities
│   │   ├── embeddings.py     # OpenAI embeddings (batch + single)
│   │   ├── vector_store.py   # ChromaDB integration
│   │   ├── ai_responses.py   # Smart reply & summarization prompts
│   │   ├── tone.py           # Tone adjustment & analysis
│   │   └── history.py        # Response history persistence
│   ├── models/               # Pydantic schemas for requests/responses (to be created)
│   └── main.py               # FastAPI app factory with router registration
├── docs/
│   ├── phase1-node-contracts.md
│   └── phase2-architecture.md
├── main.py                   # Entrypoint calling `app.main:create_app()`
└── README.md
```

## Data Flow Mapping

| Node Service | Python Replacement | Notes |
| --- | --- | --- |
| `gmailAuth.js` | `app/services/gmail.py` | Use `google-auth` credentials, refresh tokens saved to `token.json` |
| `emailService.js` | `app/services/emails.py` | HTML stripping via `BeautifulSoup` or regex; ensure identical fields |
| `embeddingService.js` | `app/services/embeddings.py` | Batch embeddings with OpenAI, same 1,536-dim vectors |
| `vectorStore.js` | `app/services/vector_store.py` | Reuse Chroma collection with identical metadata |
| `aiResponseService.js` | `app/services/ai_responses.py` | Chat prompt parity, store usage metadata |
| `toneAdjustmentService.js` | `app/services/tone.py` | Tone rewrite, analysis, batch adjustments |
| `responseHistoryService.js` | `app/services/history.py` | JSON persistence, optional future SQLite upgrade |

## Request/Response Schemas

Pydantic models will ensure parity with Node contracts captured during Phase 1. Key schemas to reproduce:

- `EmailSummary`, `EmailSearchResult`, `SmartReplySuggestion`, `ResponseHistoryEntry`
- Request models for `/search`, `/generate-response`, `/adjust-tone`, `/summarize-email`, etc.
- Shared `Metadata` objects for token usage, cost, timestamps.

## Configuration Strategy

- `app/core/config.py` will expose strongly typed settings reading from environment variables.
- Mirror existing names (`OPENAI_API_KEY`, `CHROMA_TENANT`, `MCP_PORT`, etc.) to avoid frontend changes.
- Provide defaults where applicable (e.g., `CHROMA_COLLECTION_NAME='email-embeddings'`).

## Routing Plan

FastAPI routers will be grouped by feature to keep parity with Express endpoints:

- `health.py` – `/health`, `/stats`
- `gmail.py` – `/test-gmail`, `/emails`, `/save-draft`
- `sync.py` – `/sync`, `/search`
- `ai.py` – `/generate-response`, `/summarize-email`, `/test-ai`
- `tone.py` – `/adjust-tone`, `/tone-options`, `/analyze-tone`, `/batch-adjust-tone`, `/test-tone`
- `history.py` – `/response-history`, `/response-history/{id}*`, `/user-preferences`, `/test-history`

Each router will return the same JSON shapes described in Phase 1.

## Observability & Logging

- Structured logging via Python `logging` module with JSON formatter for portability.
- Request/response logging gated by environment flag.
- Central error handler mapping Python exceptions to Node-equivalent HTTP responses (`400`, `404`, `500`).

## Deployment Considerations

- The Python service will default to the same port (`MCP_PORT` / 3000) once it replaces Node.
- During migration we will run on an alternate port (e.g., 3100) to support parallel testing.
- Future containerization can leverage a `Dockerfile` based on `python:3.11-slim`.

---
**Status:** Phase 2 decisions finalized. Implementation will begin in Phase 3 following this architecture blueprint.

