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
