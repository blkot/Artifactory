def test_register_login_me_flow(client) -> None:
    register_payload = {
        "username": "tester01",
        "email": "tester01@example.com",
        "password": "StrongPass1",
    }
    register_response = client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201

    duplicate_response = client.post("/api/v1/auth/register", json=register_payload)
    assert duplicate_response.status_code == 400

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "tester01", "password": "StrongPass1"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "tester01"


def test_register_password_validation(client) -> None:
    weak_payload = {
        "username": "weakuser",
        "email": "weak@example.com",
        "password": "weakpass",
    }
    response = client.post("/api/v1/auth/register", json=weak_payload)
    assert response.status_code == 422
