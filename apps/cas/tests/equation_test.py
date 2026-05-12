import pytest

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
    assert result.stepStatus == "partial"
    assert result.steps


def test_solve_linear_equation_uses_direct_step() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="solve",
            expression="x + 1 = 0",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "[-1]"
    assert result.steps[0].action == "solve"


def test_solve_uses_single_requested_variable() -> None:
    result = run(
        MathRequest(
            expression="y^2 = 4",
            kind="math",
            operation="solve",
            variable="y",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "[-2, 2]"


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


def test_roots_accepts_equation_form() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="roots",
            expression="x^3 - 6*x^2 + 11*x - 6 = 0",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert {root.value for root in result.items} == {"1: 1", "2: 1", "3: 1"}


def test_roots_rejects_inequality() -> None:
    with pytest.raises(ValueError, match="Roots require an expression or equation."):
        run(
            MathRequest(
                kind="math",
                operation="roots",
                expression="x > 0",
                variable="x",
            )
        )
