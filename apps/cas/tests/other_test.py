import pytest
from fastapi.testclient import TestClient

from api.index import app
from cas import discrete, geometry, parse
from cas.engine import run
from cas.schema import MathRequest, PointInput


def test_series_expansion() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="sin(x)",
            order=5,
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "x**3" in result.secondary.expression


def test_summation_and_product() -> None:
    summation = run(
        MathRequest(
            expression="x",
            kind="math",
            lower="1",
            operation="summation",
            upper="4",
            variable="x",
        )
    )
    product = run(
        MathRequest(
            expression="x",
            kind="math",
            lower="1",
            operation="product",
            upper="4",
            variable="x",
        )
    )

    assert summation.secondary
    assert summation.secondary.expression == "10"
    assert product.secondary
    assert product.secondary.expression == "24"


def test_geometry_point_operations() -> None:
    points = [PointInput(x="0", y="0"), PointInput(x="3", y="4")]
    distance = run(MathRequest(kind="math", operation="distance", points=points))
    midpoint = run(MathRequest(kind="math", operation="midpoint", points=points))
    slope = run(MathRequest(kind="math", operation="slope", points=points))
    line = run(MathRequest(kind="math", operation="line", points=points))
    circle = run(MathRequest(kind="math", operation="circle", points=points))

    assert distance.secondary
    assert distance.secondary.expression == "5"
    assert midpoint.secondary
    assert midpoint.secondary.expression == "Point2D(3/2, 2)"
    assert slope.secondary
    assert slope.secondary.expression == "4/3"
    assert line.secondary
    assert line.secondary.expression == "4*x - 3*y"
    assert circle.secondary
    assert circle.secondary.expression == "x**2 + y**2 - 25"


def test_geometry_intersections() -> None:
    equations = run(
        MathRequest(
            expressions=["x + y = 3", "x - y = 1"],
            kind="math",
            operation="intersection",
        )
    )
    points = run(
        MathRequest(
            kind="math",
            operation="intersection",
            points=[
                PointInput(x="0", y="0"),
                PointInput(x="1", y="1"),
                PointInput(x="0", y="1"),
                PointInput(x="1", y="0"),
            ],
        )
    )

    assert equations.secondary
    assert equations.secondary.expression == "[Point2D(2, 1)]"
    assert points.secondary
    assert points.secondary.expression == "[Point2D(1/2, 1/2)]"


def test_geometry_requires_enough_points() -> None:
    with pytest.raises(ValueError, match="At least 2 points are required"):
        run(
            MathRequest(
                kind="math",
                operation="distance",
                points=[PointInput(x="0", y="0")],
            )
        )


def test_unknown_geometry_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported geometry operation"):
        geometry.run(MathRequest(kind="math", operation="unknown"))


@pytest.mark.parametrize(
    ("math_request", "expected"),
    [
        (MathRequest(kind="math", k="2", n="5", operation="combination"), "10"),
        (MathRequest(kind="math", operation="gcd", values=["18", "24"]), "6"),
        (MathRequest(kind="math", n="17", operation="is_prime"), "True"),
        (MathRequest(kind="math", operation="lcm", values=["6", "8"]), "24"),
        (MathRequest(kind="math", modulus="5", n="17", operation="modular"), "2"),
        (MathRequest(kind="math", k="2", n="5", operation="permutation"), "20"),
    ],
)
def test_discrete_outputs(math_request: MathRequest, expected: str) -> None:
    result = run(math_request)

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == expected


def test_prime_factorization() -> None:
    result = run(MathRequest(kind="math", n="84", operation="prime_factorization"))

    assert result.items
    assert [entry.value for entry in result.items] == ["2^2", "3^1", "7^1"]


def test_unknown_discrete_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported discrete operation"):
        discrete.run(MathRequest(kind="math", operation="unknown"))


def test_parse_defaults_and_errors() -> None:
    assert parse.symbol(None).name == "x"
    assert [symbol.name for symbol in parse.symbols([])] == ["x"]

    with pytest.raises(ValueError, match="Expression is required"):
        parse.expression(None)
    with pytest.raises(ValueError, match="Equation is required"):
        parse.equation(None)
    with pytest.raises(ValueError, match="Matrix is required"):
        parse.matrix([])
    with pytest.raises(ValueError, match="Vector is required"):
        parse.vector([])


@pytest.mark.parametrize(
    "equation", ["x <= 1", "x >= 1", "x < 1", "x > 1", "x = 1", "x - 1"]
)
def test_parse_equation_variants(equation: str) -> None:
    assert parse.equation(equation) is not None


def test_engine_returns_inconclusive_for_unknown_operation() -> None:
    result = run(MathRequest(kind="math", operation="unknown"))

    assert result.status == "inconclusive"


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
