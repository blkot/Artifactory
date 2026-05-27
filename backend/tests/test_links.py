import time
from io import BytesIO

from PIL import Image


def _create_kit(client):
    response = client.post(
        "/api/v1/kits",
        json={
            "name": "RG Sazabi",
            "grade": "RG",
            "series": "Char's Counterattack",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_links_crud_flow(client) -> None:
    kit_id = _create_kit(client)
    initial_activity_at = client.get(f"/api/v1/kits/{kit_id}").json()["activity_at"]
    tag_response = client.post("/api/v1/tags", json={"name": "review", "color": "#abcdef"})
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    time.sleep(0.001)
    create_response = client.post(
        "/api/v1/links",
        json={
            "kit_id": kit_id,
            "url": "https://example.com/review",
            "category": "REVIEW",
            "title": "Detailed review",
            "notes": "Useful panel line tips",
            "source": "bilibili",
            "tag_ids": [tag_id],
        },
    )
    assert create_response.status_code == 201
    created_link = create_response.json()
    link_id = created_link["id"]
    assert created_link["source"] == "bilibili"
    assert created_link["thumbnail_url"] is None
    assert client.get(f"/api/v1/kits/{kit_id}").json()["activity_at"] != initial_activity_at

    list_response = client.get("/api/v1/links")
    assert list_response.status_code == 200
    assert any(item["id"] == link_id for item in list_response.json())

    update_response = client.put(
        f"/api/v1/links/{link_id}",
        json={"title": "Updated review title", "tag_ids": []},
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated review title"

    delete_response = client.delete(f"/api/v1/links/{link_id}")
    assert delete_response.status_code == 204


def test_link_thumbnail_upload_and_download(client) -> None:
    kit_id = _create_kit(client)
    create_response = client.post(
        "/api/v1/links",
        json={
            "kit_id": kit_id,
            "url": "https://b23.tv/example",
            "category": "TUTORIAL",
            "title": "Bilibili video",
            "source": "bilibili",
            "tag_ids": [],
        },
    )
    assert create_response.status_code == 201
    link_id = create_response.json()["id"]

    image = BytesIO()
    Image.new("RGB", (2, 2), color=(255, 0, 0)).save(image, format="PNG")
    image_bytes = image.getvalue()
    upload_response = client.post(
        f"/api/v1/links/{link_id}/thumbnail",
        files={"file": ("thumb.png", image_bytes, "image/png")},
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["thumbnail_url"] == f"/api/v1/links/{link_id}/thumbnail"

    thumbnail_response = client.get(f"/api/v1/links/{link_id}/thumbnail")
    assert thumbnail_response.status_code == 200
    assert thumbnail_response.content


def test_link_with_unknown_kit_returns_not_found(client) -> None:
    response = client.post(
        "/api/v1/links",
        json={
            "kit_id": 9999,
            "url": "https://example.com/tutorial",
            "category": "TUTORIAL",
            "title": "Tutorial",
            "notes": "n/a",
            "tag_ids": [],
        },
    )
    assert response.status_code == 404
    assert response.json()["error"] == "kit_not_found"


def test_duplicate_link_for_same_kit_returns_conflict(client) -> None:
    kit_id = _create_kit(client)
    payload = {
        "kit_id": kit_id,
        "url": "https://example.com/review",
        "category": "REVIEW",
        "title": "Detailed review",
        "tag_ids": [],
    }

    create_response = client.post("/api/v1/links", json=payload)
    assert create_response.status_code == 201

    duplicate_response = client.post(
        "/api/v1/links",
        json={**payload, "url": "https://example.com/review/"},
    )

    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["error"] == "conflict"
    assert duplicate_response.json()["details"]["link_id"] == create_response.json()["id"]
