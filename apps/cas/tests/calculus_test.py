import pytest

from cas.engine import run
from cas.schema import MathRequest


def test_differentiate_polynomial() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="differentiate",
            expression="x^3 - 4*x^2 + 2*x - 7",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "3*x**2 - 8*x + 2"
    assert result.stepStatus == "complete"
    assert [step.action for step in result.steps] == [
        "differentiate-term",
        "differentiate-term",
        "differentiate-term",
        "differentiate",
    ]
    assert result.steps[0].primary.expression == "Derivative(x**3, x)"


def test_differentiate_lowercase_e_exponential() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="differentiate",
            expression="e^x",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "exp(x)"


def test_integrate_polynomial() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="integrate",
            expression="2*x",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "x**2"
    assert result.stepStatus == "partial"
    assert result.steps[0].primary.expression == "Integral(2*x, x)"


def test_integrate_with_bounds() -> None:
    result = run(
        MathRequest(
            expression="x",
            kind="math",
            lower="0",
            operation="integrate",
            upper="2",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "2"
    assert result.steps[0].primary.expression == "Integral(x, (x, 0, 2))"


def test_integrate_rejects_one_sided_bounds() -> None:
    with pytest.raises(ValueError, match="lower and upper bounds"):
        run(
            MathRequest(
                expression="x",
                kind="math",
                lower="0",
                operation="integrate",
                variable="x",
            )
        )


def test_limit_rational_expression() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="limit",
            expression="sin(x) / x",
            point="0",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "1"
    assert result.stepStatus == "partial"
    assert result.steps[0].primary.expression == "Limit(sin(x)/x, x, 0, dir='+-')"


def test_limit_taylor_cancellation_expression() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="limit",
            expression="(sin(x) - x + x^3/6) / x^5",
            point="0",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "1/120"


def test_limit_rejects_different_one_sided_limits() -> None:
    with pytest.raises(ValueError, match="Two-sided limit does not exist"):
        run(
            MathRequest(
                kind="math",
                operation="limit",
                expression="1/x",
                point="0",
                variable="x",
            )
        )
