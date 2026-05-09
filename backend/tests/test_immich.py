from unittest.mock import patch


def test_immich_tags_endpoint(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_tags.return_value = [
            {"id": "uuid-1", "name": "gundam", "value": "gundam"}
        ]
        resp = client.get("/api/v1/immich/tags", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "gundam"


def test_immich_search_endpoint(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.search_assets.return_value = {
            "assets": {"items": [], "count": 0, "total": 0, "nextPage": None},
            "albums": {},
        }
        resp = client.post(
            "/api/v1/immich/search",
            json={"tagIds": ["uuid-1"], "page": 1, "size": 60},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        instance.search_assets.assert_called_once_with(["uuid-1"], page=1, size=60)


def test_create_external_immich_asset(client, auth_headers):
    # Create a kit first
    kit_resp = client.post(
        "/api/v1/kits",
        json={
            "name": "Immich Test Kit", "grade": "HG", "series": "Test",
            "brand": "Bandai", "scale": "1/144",
        },
        headers=auth_headers,
    )
    kit_id = kit_resp.json()["id"]

    # Create an external immich asset (no file upload)
    resp = client.post("/api/v1/assets", data={
        "kit_id": str(kit_id),
        "type": "BOX_ART",
        "external_source": "immich",
        "external_asset_id": "abc-123-def",
        "external_thumbnail_url": "http://immich/api/assets/abc-123/thumbnail",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["external_source"] == "immich"
    assert data["external_asset_id"] == "abc-123-def"
    assert data["external_thumbnail_url"] == "http://immich/api/assets/abc-123/thumbnail"
    assert data["file_path"] in (None, "")


def test_immich_service_error_returns_502(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_tags.side_effect = Exception("Connection refused")
        resp = client.get("/api/v1/immich/tags", headers=auth_headers)
        assert resp.status_code == 502


def test_immich_thumbnail_proxy(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_asset_thumbnail.return_value = b"\xff\xd8\xff"  # JPEG magic bytes
        resp = client.get("/api/v1/immich/assets/test-id/thumbnail", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/jpeg"


def test_asset_upload_requires_file_when_no_external_source(client, auth_headers):
    kit_resp = client.post("/api/v1/kits", json={
        "name": "File Test", "grade": "MG", "series": "Test",
        "brand": "Bandai", "scale": "1/100",
    }, headers=auth_headers)
    kit_id = kit_resp.json()["id"]

    # No file, no external_source — should fail
    resp = client.post("/api/v1/assets", data={
        "kit_id": str(kit_id),
        "type": "BOX_ART",
    }, headers=auth_headers)
    assert resp.status_code == 400
