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
    tag_response = client.post("/api/v1/tags", json={"name": "review", "color": "#abcdef"})
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    create_response = client.post(
        "/api/v1/links",
        json={
            "kit_id": kit_id,
            "url": "https://example.com/review",
            "category": "REVIEW",
            "title": "Detailed review",
            "notes": "Useful panel line tips",
            "tag_ids": [tag_id],
        },
    )
    assert create_response.status_code == 201
    link_id = create_response.json()["id"]

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
