from cas.engine import run
from cas.schema import MathRequest


def test_solve_equation() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="solve",
            expression="x^2 - 9 = 0",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "[-3, 3]"


def test_solve_inequality() -> None:
    result = run(
        MathRequest(
            expressions=["x + 1 > 3"],
            kind="math",
            operation="solve",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "2 < x" in result.secondary.expression


def test_solve_system() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="solve",
            expressions=["x + y = 3", "x - y = 1"],
            variables=["x", "y"],
        )
    )

    assert result.status == "verified"
    assert result.items[0].value == "{x: 2, y: 1}"


def test_roots_quartic() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="roots",
            expression="x^4 - 5*x^2 + 4",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert len(result.items) == 4
