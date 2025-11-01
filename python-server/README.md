# Python Server Migration Workspace

This directory will host the FastAPI implementation that replaces the existing Node.js Express server.  

## Current Status

- ✅ Phase 1 complete – Node contracts captured in `docs/phase1-node-contracts.md`.
- ✅ Phase 2 complete – Architecture & stack decisions recorded in `docs/phase2-architecture.md`.
- ✅ Phase 3 complete – FastAPI implementation delivered; see `docs/phase3-implementation.md`.
- ⏳ Next steps – regression-test parity, refine error handling, and plan rollout.

## Suggested Structure

Refer to `docs/phase2-architecture.md` for the detailed module plan. The short version:

```
python-server/
├── app/
│   ├── api/routes/      # Feature routers
│   ├── core/            # Config, logging, startup utilities
│   ├── services/        # Gmail, embeddings, vector store, AI logic
│   └── __init__.py
├── docs/                # Migration documentation and specs
├── main.py              # Entry point (loads FastAPI app)
└── README.md            # This file
```

## Running the Python Server (future)

1. `python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. `uvicorn app.main:app --reload --port 3000`

For local testing alongside the Node server, run `python python-server/main.py` to start on port `3100`.
