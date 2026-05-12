from fastapi.testclient import TestClient

from api.index import app


def test_api_requires_auth(monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")
    client = TestClient(app)

    response = client.post(
        "/api/math",
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )

    assert response.status_code == 401


def test_api_requires_configured_key(monkeypatch) -> None:
    monkeypatch.delenv("MATH_CAS_API_KEY", raising=False)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={"kind": "math", "operation": "evaluate", "expression": "2 + 2"},
    )

    assert response.status_code == 500


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

    health = client.get("/health")
    response = client.post(
        "/api/math",
        headers={"Authorization": "Bearer secret"},
        json={"kind": "math", "operation": "evaluate"},
    )

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
