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

    assert response.status_code == 200
    assert response.json()["secondary"]["expression"] == "4"


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
