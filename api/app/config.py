"""Application settings loaded from environment / optional .env file.

Mirrors .env.example at the repo root. Every var has a dev-safe default so
tests and local tooling run without a .env.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://easylife:easylife_dev@localhost:5442/easylife"
    REDIS_URL: str = "redis://localhost:6390/0"

    # --- Security ---
    SECRET_KEY: str = "change-me-in-prod"
    FERNET_MASTER_KEY: str = ""

    # --- AI (platform-owned keys) ---
    ANTHROPIC_API_KEY: str = ""
    VOYAGE_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # --- Channels ---
    EVOLUTION_API_URL: str = "http://localhost:8080"
    EVOLUTION_API_KEY: str = ""
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_WEBHOOK_VERIFY_TOKEN: str = ""

    # --- Connections aggregator (Composio) — breadth layer for IG/FB/TikTok/Gmail/... ---
    COMPOSIO_API_KEY: str = ""
    COMPOSIO_BASE_URL: str = "https://backend.composio.dev/api/v3"

    # White-label OAuth: bring-your-own provider apps so the consent screen shows
    # "Easy Life", not Composio. When a provider's creds are set, that provider's
    # toolkits use a custom auth config; otherwise they fall back to Composio-managed.
    GOOGLE_OAUTH_CLIENT_ID: str = ""  # gmail / calendar / drive
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    SLACK_OAUTH_CLIENT_ID: str = ""
    SLACK_OAUTH_CLIENT_SECRET: str = ""
    SHOPIFY_OAUTH_CLIENT_ID: str = ""
    SHOPIFY_OAUTH_CLIENT_SECRET: str = ""
    # Meta (instagram / facebook) reuses META_APP_ID / META_APP_SECRET above.

    # --- Billing (Israel) ---
    GROW_API_KEY: str = ""
    GREEN_INVOICE_API_KEY: str = ""
    GREEN_INVOICE_API_SECRET: str = ""

    # --- Platform email ---
    RESEND_API_KEY: str = ""

    # --- App ---
    APP_ENV: str = "dev"
    APP_BASE_URL: str = "http://localhost:8000"
    WEB_BASE_URL: str = "http://localhost:5173"

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV == "dev"


settings = Settings()
