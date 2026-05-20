from fastapi.testclient import TestClient

from api.index import app


def test_api_requires_auth(caplog, monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app)

    response = client.post(
        "/api/math",
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )

    assert response.status_code == 401
    assert "Authorization header is missing" in caplog.text


def test_api_requires_configured_key(caplog, monkeypatch) -> None:
    monkeypatch.delenv("MATH_CAS_API_KEY", raising=False)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )

    assert response.status_code == 500
    assert "MATH_CAS_API_KEY is not configured" in caplog.text


def test_api_rejects_invalid_auth(caplog, monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer different-secret"},
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )

    assert response.status_code == 401
    assert "bearer token does not match" in caplog.text


def test_api_accepts_auth(monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )
    payload = response.json()

    assert response.status_code == 200
    assert "distribution" not in payload["input"]
    assert "matrix" not in payload["input"]
    assert "right_matrix" not in payload["input"]
    assert "values" not in payload["input"]
    assert payload["conditions"] == []
    assert payload["items"] == []
    assert payload["steps"]
    assert payload["secondary"]["expression"] == "4"


def test_api_health_and_validation_error(monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app, raise_server_exceptions=False)

    root = client.get("/")
    health = client.get("/health")
    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={"kind": "math", "operation": "evaluate"},
    )

    assert root.status_code == 200
    assert root.headers["content-type"].startswith("text/plain")
    assert "Nakafa CAS Server" in root.text
    assert "https://cas.nakafa.com is informational only" in root.text
    assert "POST /api/math" in root.text
    assert health.json() == {"status": "ok"}
    assert response.status_code == 422
    assert response.json()["detail"] == "Expression is required."


def test_api_returns_validation_error_for_malformed_expression(monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={
            "kind": "math",
            "operation": "roots",
            "expression": "x^2 = = 0",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Expression could not be parsed."


def test_api_returns_validation_error_for_symbolic_order_statistics(
    monkeypatch,
) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={
            "kind": "math",
            "operation": "median",
            "values": ["x", "2"],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Median and quartiles require finite real numeric values."
    )
