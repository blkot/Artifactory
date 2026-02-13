from functools import lru_cache
import json
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Artifactory"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"

    host: str = "0.0.0.0"
    port: int = 8000
    api_page_size_default: int = 20
    api_page_size_max: int = 100

    database_url: str = "sqlite:///./data/artifactory.db"

    assets_dir: str = "./assets"
    max_upload_size: int = 10 * 1024 * 1024
    allowed_image_types: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/gif", "image/webp"]
    )
    allowed_video_types: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["video/mp4", "video/webm"]
    )
    allowed_doc_types: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["application/pdf"]
    )

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    log_level: str = "INFO"
    require_auth_for_reads: bool = False
    require_auth_for_writes: bool = False
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    stats_cache_enabled: bool = True
    stats_cache_ttl_seconds: int = 15
    sql_slow_query_log_enabled: bool = True
    sql_slow_query_threshold_ms: int = 200
    rate_limit_exclude_paths: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "/health",
            "/health/live",
            "/health/ready",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
        ]
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @staticmethod
    def _parse_list_value(value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("["):
            loaded = json.loads(raw)
            if isinstance(loaded, list):
                return [str(item).strip() for item in loaded if str(item).strip()]
            return []
        return [item.strip() for item in raw.split(",") if item.strip()]

    @field_validator("assets_dir")
    @classmethod
    def normalize_assets_dir(cls, value: str) -> str:
        return str(Path(value))

    @field_validator(
        "allowed_image_types",
        "allowed_video_types",
        "allowed_doc_types",
        "cors_origins",
        "rate_limit_exclude_paths",
        mode="before",
    )
    @classmethod
    def parse_list_env_values(cls, value: str | list[str]) -> list[str]:
        return cls._parse_list_value(value)

    @field_validator("cors_origins")
    @classmethod
    def normalize_cors_origins(cls, value: list[str]) -> list[str]:
        # Keep localhost and 127.0.0.1 interchangeable for local dev.
        expanded = set(value)
        for origin in value:
            parsed = urlparse(origin)
            if parsed.hostname == "localhost":
                expanded.add(origin.replace("localhost", "127.0.0.1"))
            elif parsed.hostname == "127.0.0.1":
                expanded.add(origin.replace("127.0.0.1", "localhost"))
        return sorted(expanded)

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.api_page_size_default <= 0:
            raise ValueError("API_PAGE_SIZE_DEFAULT must be > 0")
        if self.api_page_size_max < self.api_page_size_default:
            raise ValueError("API_PAGE_SIZE_MAX must be >= API_PAGE_SIZE_DEFAULT")

        if self.environment.lower() != "production":
            return self

        if self.debug:
            raise ValueError("DEBUG must be false in production")
        if self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be changed in production")
        if not self.require_auth_for_writes:
            raise ValueError("REQUIRE_AUTH_FOR_WRITES must be true in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
