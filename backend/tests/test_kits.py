from app.core.config import get_settings


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
