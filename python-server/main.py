"""Application entry point for the Smart Email Manager FastAPI server."""

import sys
from pathlib import Path

# Ensure the python-server directory is in Python path
# This allows running from any directory
_python_server_dir = Path(__file__).resolve().parent
if str(_python_server_dir) not in sys.path:
    sys.path.insert(0, str(_python_server_dir))

from app import app, create_app


def main():
    """Allows `python python-server/main.py` during development."""
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=3000, reload=True)


if __name__ == "__main__":
    main()
