import pytest

from app.core.config import Settings


def _base_production_kwargs() -> dict:
    return {
        "environment": "production",
        "debug": False,
        "secret_key": "very-strong-secret-key-1234567890",
        "require_auth_for_writes": True,
    }


def test_production_cors_rejects_wildcard() -> None:
    with pytest.raises(ValueError, match="must not include wildcard"):
        Settings(**_base_production_kwargs(), cors_origins=["*"])


def test_production_cors_rejects_localhost() -> None:
    with pytest.raises(ValueError, match="must not include localhost"):
        Settings(**_base_production_kwargs(), cors_origins=["http://localhost:3000"])


def test_production_cors_accepts_trusted_origin() -> None:
    settings = Settings(**_base_production_kwargs(), cors_origins=["https://app.example.com"])
    assert settings.cors_origins == ["https://app.example.com"]
