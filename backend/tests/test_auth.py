from conftest import PASSWORD


def test_admin_routes_require_token(client):
    for path in (
        "/api/admin/dashboard",
        "/api/admin/preincubation/applications",
        "/api/admin/startups",
        "/api/admin/records?module=events&category=upcoming",
        "/api/admin/files/1",
    ):
        response = client.get(path)
        assert response.status_code == 401, path
        assert response.json["code"] == "unauthorized"


def test_login_success_and_me(client):
    response = client.post("/api/auth/login", json={"username": "ADMIN", "password": PASSWORD})
    assert response.status_code == 200
    token = response.json["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json == {"username": "admin"}


def test_wrong_password_and_missing_body(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", data="not json").status_code == 400


def test_tampered_and_expired_tokens_are_rejected(app, client, auth):
    token = auth["Authorization"].split()[1]
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {tampered}"}).status_code == 401

    app.config["TOKEN_TTL_HOURS"] = -1
    assert client.get("/api/auth/me", headers=auth).status_code == 401


def test_token_from_other_secret_is_rejected(make_app, auth):
    other = make_app(SECRET_KEY="a-different-secret").test_client()
    assert other.get("/api/auth/me", headers=auth).status_code == 401


def test_login_rate_limited_after_repeated_failures(make_app):
    client = make_app(LOGIN_ATTEMPTS_PER_15_MIN=3).test_client()
    for _ in range(3):
        assert client.post("/api/auth/login", json={"username": "admin", "password": "bad"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD})
    assert blocked.status_code == 429


def test_login_disabled_without_configured_password(make_app):
    client = make_app(ADMIN_PASSWORD="").test_client()
    response = client.post("/api/auth/login", json={"username": "admin", "password": "anything"})
    assert response.status_code == 503


def test_password_hash_can_be_supplied_instead_of_plain_password(make_app):
    from werkzeug.security import generate_password_hash

    client = make_app(ADMIN_PASSWORD="", ADMIN_PASSWORD_HASH=generate_password_hash("hashed-pw")).test_client()
    assert client.post("/api/auth/login", json={"username": "admin", "password": "hashed-pw"}).status_code == 200


def test_cors_allows_configured_origin_with_authorization_header(client):
    response = client.options(
        "/api/admin/dashboard",
        headers={
            "Origin": "https://pre-incubation-ui.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.headers.get("Access-Control-Allow-Origin") == "https://pre-incubation-ui.vercel.app"
    assert "authorization" in response.headers.get("Access-Control-Allow-Headers", "").lower()

    evil = client.options(
        "/api/admin/dashboard",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "Access-Control-Allow-Origin" not in evil.headers
