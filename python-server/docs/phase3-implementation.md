# Phase 3 – Python Service Implementation

Phase 3 delivers the working FastAPI replacement for the Node.js server. This document highlights the key implementation details and parity checks.

## Infrastructure

- `python-server/requirements.txt` enumerates runtime dependencies (FastAPI, uvicorn, OpenAI, ChromaDB, Google API clients, etc.).
- `app/core/config.py` loads the same environment variables as the Node server via `pydantic-settings`, ensuring drop-in compatibility for existing `.env` files.
- `app/core/logging.py` provides structured logging setup reused across services.

## Application Structure

```
app/
├── api/
│   ├── deps.py               # Cached dependency providers (services, settings)
│   └── routes/
│       ├── health.py         # /health, /stats
│       ├── gmail.py          # /test-gmail, /emails, /save-draft
│       ├── search.py         # /sync, /search
│       ├── ai.py             # /generate-response, /summarize-email, /test-ai
│       ├── tone.py           # Tone adjustment endpoints
│       └── history.py        # Response history management
├── core/
│   ├── config.py             # Settings loader mirroring Node env keys
│   └── logging.py            # Root logging configuration
├── models/                   # Pydantic schemas for requests/responses
├── services/                 # Gmail, embeddings, Chroma, AI, tone, history logic
└── main.py                   # Application factory, router registration, static assets
```

The root `python-server/main.py` exposes `create_app()`/`app` for uvicorn while providing a convenience `python python-server/main.py` entry point.

## Service Parity

- **Gmail (`services/gmail.py`)** – OAuth flow with token persistence, draft creation identical to Node behaviour.
- **Email Parsing (`services/emails.py`)** – HTML stripping via BeautifulSoup, body decoding, importance heuristics.
- **Embeddings (`services/embeddings.py`)** – OpenAI embeddings wrapper for single/batch requests, including email preprocessing.
- **Vector Store (`services/vector_store.py`)** – ChromaDB client supporting local or cloud deployments, metadata identical to Node version.
- **AI Responses (`services/ai_responses.py`)** – Smart reply generation, summarisation, history persistence with token/cost metadata.
- **Tone Adjustment (`services/tone.py`)** – Tone rewriting, analysis, and batch adjustment with standardised prompts.
- **Response History (`services/history.py`)** – JSON persistence layer replicating status workflow (`generated`, `selected`, `saved_to_draft`).

## API Contracts

- All Phase 1 endpoints are implemented with FastAPI routers, returning JSON payloads aligned with the documented contracts.
- Request validation uses Pydantic models (e.g., `GenerateResponseRequest`, `ToneAdjustmentRequest`, `SaveDraftRequest`).
- Static assets from `web-app/` are mounted at the root path to match Express behaviour.

## Operational Notes

- `app/api/deps.py` caches service instances to avoid repeated client creation per request.
- Default port remains `3000` via configuration; during parallel testing the helper launcher runs on `3100` (`python python-server/main.py`).
- Logging mirrors the Node console output style (info banners and error messages).

Phase 3 is now complete: FastAPI serves all required endpoints, backed by feature-equivalent service modules.

