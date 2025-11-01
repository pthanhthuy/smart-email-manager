"""FastAPI application factory and router registration."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import ai, gmail, health, history, search, tone, summary_tts
from app.core.logging import configure_logging

WEB_APP_DIR = Path(__file__).resolve().parent.parent.parent / "web-app"


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="Smart Email Manager API",
        version="0.1.0",
        description="Python FastAPI implementation replacing the Node.js server",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health.router)
    app.include_router(gmail.router)
    app.include_router(search.router)
    app.include_router(ai.router)
    app.include_router(tone.router)
    app.include_router(history.router)
    app.include_router(summary_tts.router)

    # Static files (mirrors Express static serving)
    if WEB_APP_DIR.exists():
        app.mount("/", StaticFiles(directory=str(WEB_APP_DIR), html=True), name="web-app")

    return app


app = create_app()
