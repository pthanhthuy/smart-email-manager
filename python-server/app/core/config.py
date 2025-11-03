from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve important paths
PYTHON_SERVER_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = PYTHON_SERVER_DIR.parent
OVERRIDE_ENV_PATH = PYTHON_SERVER_DIR / ".env"


class Settings(BaseSettings):
    """Application configuration loaded from environment variables or `.env`."""

    # Server configuration
    mcp_port: int = Field(default=3000, alias="MCP_PORT")
    node_env: str = Field(default="development", alias="NODE_ENV")

    # OpenAI (chat + completion)
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: Optional[str] = Field(default=None, alias="OPENAI_BASE_URL")
    openai_model: str = Field(default="gpt-4o-mini", alias="MODEL")
    max_response_tokens: int = Field(default=500, alias="MAX_RESPONSE_TOKENS")

    # Embeddings
    embedding_api_key: Optional[str] = Field(default=None, alias="OPEN_API_KEY_FOR_TEXT_EMBEDDING")
    embedding_model: str = Field(default="text-embedding-3-small", alias="EMBEDDING_MODEL")

    # ChromaDB
    chroma_use_local: bool = Field(default=False, alias="CHROMA_USE_LOCAL")
    chroma_api_key: Optional[str] = Field(default=None, alias="CHROMA_API_KEY")
    chroma_tenant: Optional[str] = Field(default=None, alias="CHROMA_TENANT")
    chroma_database: Optional[str] = Field(default=None, alias="CHROMA_DATABASE")
    chroma_collection_name: str = Field(default="email-embeddings", alias="CHROMA_COLLECTION_NAME")
    chroma_cloud_url: Optional[str] = Field(default=None, alias="CHROMA_CLOUD_URL")

    # Gmail sync
    max_emails: int = Field(default=300, alias="MAX_EMAILS")
    sync_interval_ms: int = Field(default=300_000, alias="SYNC_INTERVAL")

    # Misc external services
    huggingface_api_key: Optional[str] = Field(default=None, alias="HUGGINGFACE_API_KEY")
    hf_token: Optional[str] = Field(default=None, alias="HF_TOKEN")
    
    # TTS Configuration
    tts_model: str = Field(default="suno/bark-small", alias="TTS_MODEL")
    tts_cache_dir: str = Field(default="./summary_tts_cache", alias="TTS_CACHE_DIR")
    tts_max_text_length: int = Field(default=500, alias="TTS_MAX_TEXT_LENGTH")

    # File system paths
    # Note: credentials and tokens are in python-server/server/ directory
    credentials_path: Path = Field(
        default_factory=lambda: PYTHON_SERVER_DIR / "server" / "credentials.json",
        alias="GMAIL_CREDENTIALS_PATH",
    )
    token_path: Path = Field(
        default_factory=lambda: PYTHON_SERVER_DIR / "server" / "token.json",
        alias="GMAIL_TOKEN_PATH",
    )
    response_history_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "server" / "response-history.json",
        alias="RESPONSE_HISTORY_PATH",
    )

    model_config = SettingsConfigDict(
        env_file=(OVERRIDE_ENV_PATH, PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()
