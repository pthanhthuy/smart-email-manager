"""
Logging utilities for the Smart Email Manager FastAPI application.
"""

import logging
from typing import Optional


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logger with simple structured format."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a logger instance, configuring the root logger on first use."""
    if not logging.getLogger().handlers:
        configure_logging()
    return logging.getLogger(name or "smart-email-manager")
