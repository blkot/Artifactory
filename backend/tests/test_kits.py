import time

from app.core.config import get_settings


def test_activity_at_bumps_for_status_change_but_not_tags(client) -> None:
    first_tag = client.post("/api/v1/tags", json={"name": "activity-tag", "color": "#123456"})
    assert first_tag.status_code == 201

    first = client.post(
        "/api/v1/kits",
        json={
            "name": "Activity First",
            "grade": "RG",
            "series": "UC",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert first.status_code == 201
    first_payload = first.json()
    first_id = first_payload["id"]
    initial_activity_at = first_payload["activity_at"]

    second = client.post(
        "/api/v1/kits",
        json={
            "name": "Activity Second",
            "grade": "MG",
            "series": "Seed",
            "brand": "Bandai",
            "scale": "1/100",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert second.status_code == 201

    tag_update = client.put(
        f"/api/v1/kits/{first_id}",
        json={"tag_ids": [first_tag.json()["id"]]},
    )
    assert tag_update.status_code == 200
    assert tag_update.json()["activity_at"] == initial_activity_at

    time.sleep(0.001)
    status_update = client.put(
        f"/api/v1/kits/{first_id}",
        json={"build_status": "IN_PROGRESS"},
    )
    assert status_update.status_code == 200
    assert status_update.json()["activity_at"] != initial_activity_at

    list_response = client.get("/api/v1/kits")
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["id"] == first_id


def test_kits_crud_and_search(client) -> None:
    tag = client.post("/api/v1/tags", json={"name": "weathering", "color": "#123456"})
    assert tag.status_code == 201
    tag_id = tag.json()["id"]

    create_payload = {
        "name": "RG God Gundam",
        "grade": "RG",
        "series": "Mobile Fighter G Gundam",
        "brand": "Bandai",
        "scale": "1/144",
        "kit_number": "RG-37",
        "purchase_price": 35.99,
        "build_status": "NEW",
        "tag_ids": [tag_id],
    }
    create_response = client.post("/api/v1/kits", json=create_payload)
    assert create_response.status_code == 201
    kit_id = create_response.json()["id"]

    list_response = client.get("/api/v1/kits")
    assert list_response.status_code == 200
    assert list_response.json()["total"] >= 1

    detail_response = client.get(f"/api/v1/kits/{kit_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["name"] == "RG God Gundam"

    search_response = client.get("/api/v1/kits/search", params={"q": "God", "grade": "RG"})
    assert search_response.status_code == 200
    assert search_response.json()["total"] >= 1

    update_response = client.put(
        f"/api/v1/kits/{kit_id}",
        json={"build_status": "IN_PROGRESS", "purchase_shop": "Local Shop"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["build_status"] == "IN_PROGRESS"

    timeline_response = client.post(
        f"/api/v1/kits/{kit_id}/timeline",
        json={"status": "IN_PROGRESS", "notes": "Started torso"},
    )
    assert timeline_response.status_code == 201

    delete_response = client.delete(f"/api/v1/kits/{kit_id}")
    assert delete_response.status_code == 204


def test_kit_validation_purchase_price(client) -> None:
    payload = {
        "name": "HG Aerial",
        "grade": "HG",
        "series": "The Witch from Mercury",
        "brand": "Bandai",
        "scale": "1/144",
        "purchase_price": -1,
        "build_status": "NEW",
        "tag_ids": [],
    }
    response = client.post("/api/v1/kits", json=payload)
    assert response.status_code == 422


def test_kits_limit_respects_config_max(client) -> None:
    settings = get_settings()
    response = client.get("/api/v1/kits", params={"limit": settings.api_page_size_max + 1})
    assert response.status_code == 422


def test_kits_search_supports_filters_and_pagination(client) -> None:
    weathering = client.post("/api/v1/tags", json={"name": "weathering-search", "color": "#111111"})
    panel = client.post("/api/v1/tags", json={"name": "panel-line", "color": "#222222"})
    assert weathering.status_code == 201
    assert panel.status_code == 201
    weathering_id = weathering.json()["id"]
    panel_id = panel.json()["id"]

    kits = [
        {
            "name": "RG Nu Gundam",
            "grade": "RG",
            "series": "Universal Century",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [weathering_id],
        },
        {
            "name": "MG Barbatos",
            "grade": "MG",
            "series": "Iron-Blooded Orphans",
            "brand": "Bandai",
            "scale": "1/100",
            "build_status": "IN_PROGRESS",
            "tag_ids": [panel_id],
        },
        {
            "name": "RG Sazabi",
            "grade": "RG",
            "series": "Universal Century",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "COMPLETED",
            "tag_ids": [weathering_id, panel_id],
        },
    ]
    for payload in kits:
        create_response = client.post("/api/v1/kits", json=payload)
        assert create_response.status_code == 201

    filtered = client.get(
        "/api/v1/kits/search",
        params={"grade": "RG", "series": "Universal", "tag": "weathering-search"},
    )
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["total"] == 2
    assert all(item["grade"] == "RG" for item in filtered_payload["items"])

    paged = client.get(
        "/api/v1/kits/search",
        params={"grade": "RG", "skip": 1, "limit": 1},
    )
    assert paged.status_code == 200
    paged_payload = paged.json()
    assert paged_payload["total"] == 2
    assert len(paged_payload["items"]) == 1


def test_kits_search_supports_multiple_brand_series_scale_and_tag_filters(client) -> None:
    weathering = client.post("/api/v1/tags", json={"name": "weathering-multi", "color": "#333333"})
    resin = client.post("/api/v1/tags", json={"name": "resin", "color": "#444444"})
    assert weathering.status_code == 201
    assert resin.status_code == 201
    weathering_id = weathering.json()["id"]
    resin_id = resin.json()["id"]

    kits = [
        {
            "name": "RG Hi-Nu",
            "grade": "RG",
            "series": "UC",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [weathering_id],
        },
        {
            "name": "Frame Arms Baselard",
            "grade": "CUSTOM",
            "series": "Frame Arms Girl",
            "brand": "Kotobukiya",
            "scale": "1/100",
            "build_status": "NEW",
            "tag_ids": [resin_id],
        },
        {
            "name": "Unrelated Kit",
            "grade": "HG",
            "series": "Other",
            "brand": "SomeOtherBrand",
            "scale": "1/60",
            "build_status": "NEW",
            "tag_ids": [],
        },
    ]
    for payload in kits:
        response = client.post("/api/v1/kits", json=payload)
        assert response.status_code == 201

    multi_filtered = client.get(
        "/api/v1/kits/search",
        params=[
            ("brand", "Bandai"),
            ("brand", "Kotobukiya"),
            ("series", "UC"),
            ("series", "Frame Arms"),
            ("scale", "1/144"),
            ("scale", "1/100"),
            ("tag", "weathering-multi"),
            ("tag", "resin"),
        ],
    )
    assert multi_filtered.status_code == 200
    payload = multi_filtered.json()
    assert payload["total"] == 2
    names = {item["name"] for item in payload["items"]}
    assert names == {"RG Hi-Nu", "Frame Arms Baselard"}


def test_kits_search_filters_are_case_insensitive_for_scale_brand_status_and_grade(client) -> None:
    create_response = client.post(
        "/api/v1/kits",
        json={
            "name": "Case Sensitivity Kit",
            "grade": "RG",
            "series": "Universal Century",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "IN_PROGRESS",
            "tag_ids": [],
        },
    )
    assert create_response.status_code == 201

    response = client.get(
        "/api/v1/kits/search",
        params=[
            ("grade", "rg"),
            ("build_status", "in_progress"),
            ("brand", "bAnDaI"),
            ("scale", "1/144"),
        ],
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["name"] == "Case Sensitivity Kit"


def test_create_kit_with_thumbnail_asset_id(client, auth_headers) -> None:
    """Creating a kit accepts thumbnail_asset_id."""
    payload = {
        "name": "Thumb Test",
        "grade": "HG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/144",
        "thumbnail_asset_id": None,
    }
    response = client.post("/api/v1/kits", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["thumbnail_asset_id"] is None


def test_update_kit_thumbnail_asset_id(client, auth_headers) -> None:
    """Updating a kit with thumbnail_asset_id persists the value."""
    create_resp = client.post("/api/v1/kits", json={
        "name": "Thumb Update Test",
        "grade": "MG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/100",
    }, headers=auth_headers)
    kit_id = create_resp.json()["id"]

    update_resp = client.put(f"/api/v1/kits/{kit_id}", json={
        "thumbnail_asset_id": 999,
    }, headers=auth_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["thumbnail_asset_id"] == 999

    update_resp2 = client.put(f"/api/v1/kits/{kit_id}", json={
        "thumbnail_asset_id": None,
    }, headers=auth_headers)
    assert update_resp2.status_code == 200
    assert update_resp2.json()["thumbnail_asset_id"] is None


def test_kit_read_includes_thumbnail_asset_id(client, auth_headers) -> None:
    """Kit read responses include the thumbnail_asset_id field."""
    create_resp = client.post("/api/v1/kits", json={
        "name": "Thumb Read Test",
        "grade": "RG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/144",
    }, headers=auth_headers)
    kit_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/kits/{kit_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "thumbnail_asset_id" in data
    assert data["thumbnail_asset_id"] is None
