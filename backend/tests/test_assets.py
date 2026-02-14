def _create_kit(client):
    response = client.post(
        "/api/v1/kits",
        json={
            "name": "MG Freedom",
            "grade": "MG",
            "series": "SEED",
            "brand": "Bandai",
            "scale": "1/100",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_assets_upload_read_download_delete_flow(client) -> None:
    kit_id = _create_kit(client)
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"

    upload_response = client.post(
        "/api/v1/assets",
        data={
            "kit_id": str(kit_id),
            "type": "DOCUMENT",
            "description": "manual",
            "is_external_reference": "false",
        },
        files={"file": ("manual.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_response.status_code == 201

    asset = upload_response.json()
    asset_id = asset["id"]

    metadata_response = client.get(f"/api/v1/assets/{asset_id}")
    assert metadata_response.status_code == 200
    assert metadata_response.json()["mime_type"] == "application/pdf"

    file_response = client.get(f"/api/v1/assets/{asset_id}/file")
    assert file_response.status_code == 200
    assert file_response.content.startswith(b"%PDF")

    delete_response = client.delete(f"/api/v1/assets/{asset_id}")
    assert delete_response.status_code == 204


def test_asset_invalid_file_type_returns_400(client) -> None:
    kit_id = _create_kit(client)

    response = client.post(
        "/api/v1/assets",
        data={
            "kit_id": str(kit_id),
            "type": "DOCUMENT",
            "description": "invalid",
            "is_external_reference": "false",
        },
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_file_type"


def test_assets_list_supports_kit_filter_and_pagination(client) -> None:
    first_kit_id = _create_kit(client)
    second_kit_id = _create_kit(client)
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"

    for kit_id in [first_kit_id, first_kit_id, second_kit_id]:
        response = client.post(
            "/api/v1/assets",
            data={
                "kit_id": str(kit_id),
                "type": "DOCUMENT",
                "description": "manual",
                "is_external_reference": "false",
            },
            files={"file": ("manual.pdf", pdf_bytes, "application/pdf")},
        )
        assert response.status_code == 201

    list_all = client.get("/api/v1/assets")
    assert list_all.status_code == 200
    all_payload = list_all.json()
    assert all_payload["total"] == 3
    assert len(all_payload["items"]) == 3

    filtered = client.get(f"/api/v1/assets?kit_id={first_kit_id}")
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["total"] == 2
    assert len(filtered_payload["items"]) == 2
    assert all(item["kit_id"] == first_kit_id for item in filtered_payload["items"])

    paged = client.get("/api/v1/assets?skip=1&limit=1")
    assert paged.status_code == 200
    paged_payload = paged.json()
    assert paged_payload["total"] == 3
    assert len(paged_payload["items"]) == 1
