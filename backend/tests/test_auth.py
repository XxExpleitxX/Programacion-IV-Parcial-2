"""Tests de autenticación."""


def _register(client, username="nuevo"):
    return client.post("/api/v1/auth/register", json={
        "username": username, "nombre": "Juan", "apellido": "Perez",
        "email": f"{username}@test.com", "password": "Secret123",
    })


def test_register_ok(client):
    r = _register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "nuevo@test.com"
    assert "ADMIN" not in body["roles"]   # por defecto CLIENT, no admin


def test_login_ok(client):
    _register(client, "loginuser")
    r = client.post("/api/v1/auth/login", json={"username": "loginuser", "password": "Secret123"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0


def test_login_credenciales_invalidas(client):
    _register(client, "baduser")
    r = client.post("/api/v1/auth/login", json={"username": "baduser", "password": "incorrecta"})
    assert r.status_code == 401


def test_logout_revoca_refresh(client):
    _register(client, "logoutuser")
    login = client.post("/api/v1/auth/login", json={"username": "logoutuser", "password": "Secret123"})
    refresh = login.json()["refresh_token"]
    r = client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert r.status_code == 204
    # El refresh ya revocado no debe servir
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 401


def test_rate_limit_429(client):
    _register(client, "ratelimit")
    # 5 intentos fallidos permitidos, el 6° debe cortar con 429
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"username": "ratelimit", "password": "mala"})
        assert r.status_code == 401
    r6 = client.post("/api/v1/auth/login", json={"username": "ratelimit", "password": "mala"})
    assert r6.status_code == 429
    assert "Retry-After" in r6.headers
