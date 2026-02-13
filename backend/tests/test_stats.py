def test_stats_endpoint(client) -> None:
    client.post(
        "/api/v1/kits",
        json={
            "name": "HG Exia",
            "grade": "HG",
            "series": "00",
            "brand": "Bandai",
            "scale": "1/144",
            "purchase_price": 20.5,
            "build_status": "COMPLETED",
            "tag_ids": [],
        },
    )
    client.post(
        "/api/v1/kits",
        json={
            "name": "MG Barbatos",
            "grade": "MG",
            "series": "IBO",
            "brand": "Bandai",
            "scale": "1/100",
            "purchase_price": 45.0,
            "build_status": "NEW",
            "tag_ids": [],
        },
    )

    response = client.get("/api/v1/stats")
    assert response.status_code == 200

    data = response.json()
    assert data["total_kits"] >= 2
    assert data["total_spent"] >= 65.5
    assert data["completion_rate"] > 0
