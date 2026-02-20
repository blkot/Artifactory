def test_tags_create_and_update(client) -> None:
    create_response = client.post("/api/v1/tags", json={"name": "weathering", "color": "#111111"})
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/v1/tags/{tag_id}",
        json={"name": "weathering-renamed", "color": "#222222"},
    )
    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["name"] == "weathering-renamed"
    assert payload["color"] == "#222222"


def test_tags_update_rejects_duplicate_name_case_insensitive(client) -> None:
    first = client.post("/api/v1/tags", json={"name": "PanelLine", "color": "#111111"})
    second = client.post("/api/v1/tags", json={"name": "Weathering", "color": "#222222"})
    assert first.status_code == 201
    assert second.status_code == 201

    second_id = second.json()["id"]
    duplicate = client.put(f"/api/v1/tags/{second_id}", json={"name": "panelline"})
    assert duplicate.status_code == 400
