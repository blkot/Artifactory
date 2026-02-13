from app.core.config import get_settings


def _create_kit(client, headers=None) -> int:
    response = client.post(
        "/api/v1/kits",
        headers=headers or {},
        json={
            "name": "Policy Kit",
            "grade": "HG",
            "series": "UC",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_read_endpoints_require_auth_when_enabled(client, auth_headers) -> None:
    settings = get_settings()
    settings.require_auth_for_reads = True
    settings.require_auth_for_writes = False

    kit_id = _create_kit(client)

    upload_response = client.post(
        "/api/v1/assets",
        data={
            "kit_id": str(kit_id),
            "type": "DOCUMENT",
            "description": "manual",
            "is_external_reference": "false",
        },
        files={"file": ("manual.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )
    assert upload_response.status_code == 201
    asset_id = upload_response.json()["id"]

    # No auth -> blocked
    assert client.get("/api/v1/kits").status_code == 401
    assert client.get("/api/v1/tags").status_code == 401
    assert client.get("/api/v1/stats").status_code == 401
    assert client.get("/api/v1/links").status_code == 401
    assert client.get(f"/api/v1/assets/{asset_id}").status_code == 401

    # With auth -> allowed
    assert client.get("/api/v1/kits", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/tags", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/stats", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/links", headers=auth_headers).status_code == 200
    assert client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers).status_code == 200


def test_write_endpoints_require_auth_when_enabled(client, auth_headers) -> None:
    settings = get_settings()
    settings.require_auth_for_writes = True
    settings.require_auth_for_reads = False

    # No auth -> blocked
    assert client.post("/api/v1/tags", json={"name": "auth-only", "color": "#000000"}).status_code == 401

    # With auth -> allowed
    tag_response = client.post(
        "/api/v1/tags",
        headers=auth_headers,
        json={"name": "auth-only", "color": "#000000"},
    )
    assert tag_response.status_code == 201

    kit_id = _create_kit(client, headers=auth_headers)

    link_response = client.post(
        "/api/v1/links",
        headers=auth_headers,
        json={
            "kit_id": kit_id,
            "url": "https://example.com/policy",
            "category": "REVIEW",
            "title": "Policy Review",
            "notes": "auth required",
            "tag_ids": [],
        },
    )
    assert link_response.status_code == 201

    no_auth_link = client.post(
        "/api/v1/links",
        json={
            "kit_id": kit_id,
            "url": "https://example.com/no-auth",
            "category": "REVIEW",
            "title": "No Auth",
            "notes": "should fail",
            "tag_ids": [],
        },
    )
    assert no_auth_link.status_code == 401
