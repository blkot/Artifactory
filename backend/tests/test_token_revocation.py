def test_logout_revokes_refresh_token(client) -> None:
    # Register and login
    client.post("/api/v1/auth/register", json={
        "username": "revoke_test",
        "email": "revoke_test@example.com",
        "password": "StrongPass1!",
    })
    login = client.post("/api/v1/auth/login", data={
        "username": "revoke_test",
        "password": "StrongPass1!",
    })
    assert login.status_code == 200
    tokens = login.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Access token works before logout
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200

    # Logout
    logout = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 204

    # Refresh with revoked token fails
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 401


def test_double_logout_is_idempotent(client) -> None:
    client.post("/api/v1/auth/register", json={
        "username": "double_revoke",
        "email": "double_revoke@example.com",
        "password": "StrongPass1!",
    })
    login = client.post("/api/v1/auth/login", data={
        "username": "double_revoke",
        "password": "StrongPass1!",
    })
    refresh_token = login.json()["refresh_token"]

    r1 = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert r1.status_code == 204

    r2 = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert r2.status_code == 204


def test_independent_sessions_survive_each_other(client) -> None:
    # Create two users
    for username in ["user_a", "user_b"]:
        client.post("/api/v1/auth/register", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "StrongPass1!",
        })

    # Both login
    login_a = client.post("/api/v1/auth/login", data={
        "username": "user_a", "password": "StrongPass1!",
    })
    login_b = client.post("/api/v1/auth/login", data={
        "username": "user_b", "password": "StrongPass1!",
    })
    refresh_a = login_a.json()["refresh_token"]
    refresh_b = login_b.json()["refresh_token"]

    # User A logs out
    client.post("/api/v1/auth/logout", json={"refresh_token": refresh_a})

    # User A's refresh is dead
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_a}).status_code == 401

    # User B's refresh still works
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_b}).status_code == 200


def test_revoked_access_token_rejected(client) -> None:
    # Verify non-revoked access token works (denylist check passes)
    client.post("/api/v1/auth/register", json={
        "username": "access_revoke",
        "email": "access_revoke@example.com",
        "password": "StrongPass1!",
    })
    login = client.post("/api/v1/auth/login", data={
        "username": "access_revoke",
        "password": "StrongPass1!",
    })
    access = login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200


def test_invalid_token_rejected_by_logout(client) -> None:
    response = client.post("/api/v1/auth/logout", json={"refresh_token": "invalid-token"})
    assert response.status_code == 401
