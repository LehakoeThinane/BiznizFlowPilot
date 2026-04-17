"""Application configuration and settings."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # App
    app_name: str = "BiznizFlowPilot"
    debug: bool = False
    version: str = "0.1.0"

    # Database
    database_url: str = "postgresql://user:password@localhost:5432/biznizflowpilot_db"

    # JWT
    secret_key: str = "your-super-secret-key-change-in-production"  # CHANGE THIS
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    refresh_token_expiration_days: int = 7

    # API
    api_base_url: str = "http://localhost:8000"
    api_v1_prefix: str = "/api/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Environment
    environment: str = "development"  # development, staging, production

    # Redis (for future use)
    redis_url: str = "redis://localhost:6379/0"

    # Pagination
    default_page_size: int = 20
    max_page_size: int = 100

    # Logging
    log_level: str = "INFO"

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
