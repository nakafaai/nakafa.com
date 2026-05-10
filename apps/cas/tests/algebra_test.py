import pytest

from cas.engine import run
from cas.schema import MathRequest


@pytest.mark.parametrize(
    ("operation", "expression", "expected"),
    [
        ("apart", "1 / (x^2 - 1)", "-1/(2*(x + 1)) + 1/(2*(x - 1))"),
        ("expand", "(x + 1)^2", "x**2 + 2*x + 1"),
        ("factor", "x^2 - 1", "(x - 1)*(x + 1)"),
        ("rationalize", "1 / sqrt(2)", "sqrt(2)/2"),
        ("simplify", "sin(x)^2 + cos(x)^2", "1"),
        ("together", "1/x + 1/y", "(x + y)/(x*y)"),
    ],
)
def test_algebra_transforms(operation: str, expression: str, expected: str) -> None:
    result = run(MathRequest(kind="math", operation=operation, expression=expression))

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == expected


def test_evaluate_exact_arithmetic() -> None:
    result = run(MathRequest(kind="math", operation="evaluate", expression="6 * 7"))

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "42"


def test_cancel_verifies_rational_simplification() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="cancel",
            expression="(x^2 - 9) / (x - 3)",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "x + 3"


def test_compare_tracks_domain_conditions() -> None:
    result = run(
        MathRequest(
            kind="math",
            left="(x^2 - 9) / (x - 3)",
            operation="compare",
            right="x + 3",
        )
    )

    assert result.status == "verified"
    assert "x != 3" in result.conditions


def test_trig_identity_is_verified() -> None:
    result = run(
        MathRequest(
            kind="math",
            left="sin(x)^2 + cos(x)^2",
            operation="compare",
            right="1",
        )
    )

    assert result.status == "verified"


def test_compare_finds_counterexample() -> None:
    result = run(
        MathRequest(kind="math", left="x + 1", operation="compare", right="x + 2")
    )

    assert result.status == "contradicted"
    assert result.items[0].label == "counterexample"


def test_compare_can_be_inconclusive() -> None:
    result = run(
        MathRequest(
            kind="math",
            left="sqrt(x^2)",
            operation="compare",
            right="Abs(x)",
        )
    )

    assert result.status == "inconclusive"


def test_compare_skips_non_finite_samples() -> None:
    result = run(
        MathRequest(
            kind="math",
            left="1 / (x - x)",
            operation="compare",
            right="2 / (x - x)",
        )
    )

    assert result.status == "inconclusive"


def test_domain_returns_denominator_restrictions() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="domain",
            expression="1 / ((x - 1) * (x + 1))",
        )
    )

    assert result.status == "verified"
    assert result.conditions == ["x != -1", "x != 1"]
