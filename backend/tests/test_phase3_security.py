from app.core.config import get_settings
from app.core.rate_limit import InMemoryRateLimiter
from app.main import app


def test_require_auth_for_writes_toggle(client) -> None:
    settings = get_settings()
    settings.require_auth_for_writes = True

    payload = {
        "name": "HG Auth Gate",
        "grade": "HG",
        "series": "UC",
        "brand": "Bandai",
        "scale": "1/144",
        "build_status": "NEW",
        "tag_ids": [],
    }

    no_auth_response = client.post("/api/v1/kits", json=payload)
    assert no_auth_response.status_code == 401

    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": "secured_user",
            "email": "secured_user@example.com",
            "password": "StrongPass1",
        },
    )
    assert register.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        data={"username": "secured_user", "password": "StrongPass1"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    with_auth_response = client.post(
        "/api/v1/kits",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert with_auth_response.status_code == 201


def test_rate_limit_returns_429(client) -> None:
    settings = get_settings()
    settings.rate_limit_enabled = True
    settings.rate_limit_requests = 2
    settings.rate_limit_window_seconds = 60
    app.state.rate_limiter = InMemoryRateLimiter(limit=2, window_seconds=60)

    first = client.get("/api/v1/tags")
    second = client.get("/api/v1/tags")
    third = client.get("/api/v1/tags")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["error"] == "rate_limit_exceeded"
