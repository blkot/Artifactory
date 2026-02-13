def test_health(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_live(client) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["check"] == "liveness"


def test_health_ready(client) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["check"] == "readiness"
