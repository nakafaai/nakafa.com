import pytest

from cas import algebra
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
    assert result.stepStatus == "complete"
    assert result.steps[0].action == "evaluate"
    assert result.steps[0].secondary
    assert result.steps[0].secondary.expression == "42"


@pytest.mark.parametrize("expression", ["factorial(5)", "5!"])
def test_evaluate_factorial(expression: str) -> None:
    result = run(MathRequest(kind="math", operation="evaluate", expression=expression))

    assert result.status == "verified"
    assert result.primary.expression == "120"
    assert result.secondary
    assert result.secondary.expression == "120"


def test_evaluate_keeps_original_expression_steps() -> None:
    result = run(
        MathRequest(kind="math", operation="evaluate", expression="125 * 48 / 6")
    )

    assert result.primary.expression == "125*48/6"
    assert result.secondary
    assert result.secondary.expression == "1000"
    assert [step.action for step in result.steps] == ["divide", "evaluate"]
    assert result.steps[0].primary.expression == "48/6"
    assert result.steps[0].secondary
    assert result.steps[0].secondary.expression == "8"


def test_evaluate_omits_redundant_steps_for_unchanged_expression() -> None:
    result = run(MathRequest(kind="math", operation="evaluate", expression="42"))

    assert result.secondary
    assert result.secondary.expression == "42"
    assert result.stepStatus == "unavailable"
    assert result.steps == []


def test_evaluate_falls_back_for_symbolic_simplification() -> None:
    result = run(
        MathRequest(kind="math", operation="evaluate", expression="(x + 1) + (x + 2)")
    )

    assert result.secondary
    assert result.secondary.expression == "2*x + 3"
    assert result.steps[0].action == "evaluate"


def test_evaluate_reduces_rational_numeric_reciprocal() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="evaluate",
            expression="Rational(1, 3) * 12",
        )
    )

    assert result.secondary
    assert result.secondary.expression == "4"
    assert result.steps[0].primary.expression == "12/3"
    assert result.steps[0].secondary
    assert result.steps[0].secondary.expression == "4"


def test_evaluate_falls_back_without_numeric_division_numerator() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="evaluate",
            expression="x * Rational(1, 3)",
        )
    )

    assert result.secondary
    assert result.secondary.expression == "x/3"
    assert result.steps[0].action == "evaluate"


@pytest.mark.parametrize("expression", ["1/0", "0/0", "oo", "-oo", "x/0"])
def test_evaluate_rejects_non_finite_results(expression: str) -> None:
    with pytest.raises(ValueError, match="finite value"):
        run(MathRequest(kind="math", operation="evaluate", expression=expression))


def test_transform_rejects_non_finite_results() -> None:
    with pytest.raises(ValueError, match="finite value"):
        run(MathRequest(kind="math", operation="simplify", expression="1/0"))


def test_evaluate_rejects_tuple_expressions() -> None:
    with pytest.raises(ValueError, match="one mathematical value"):
        run(
            MathRequest(
                kind="math",
                operation="evaluate",
                expression="((1 + 4) / 2, (2 + 6) / 2)",
            )
        )


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
    assert [step.action for step in result.steps] == ["factor", "cancel"]


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
    assert result.conditions[0].latex == "x \\neq 3"
    assert [step.action for step in result.steps] == ["compare", "compare"]


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
    assert result.steps[0].action == "compare"


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
    assert [condition.latex for condition in result.conditions] == [
        "x \\neq -1",
        "x \\neq 1",
    ]


@pytest.mark.parametrize(
    ("expression", "expected_latex"),
    [
        ("sqrt(x)", ["x \\geq 0"]),
        ("log(x)", ["x > 0"]),
    ],
)
def test_domain_returns_real_valued_restrictions(
    expression: str, expected_latex: list[str]
) -> None:
    result = run(MathRequest(kind="math", operation="domain", expression=expression))

    assert result.status == "verified"
    assert result.secondary
    assert [condition.latex for condition in result.conditions] == expected_latex


def test_domain_returns_no_conditions_for_all_reals() -> None:
    result = run(MathRequest(kind="math", operation="domain", expression="x^2"))

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "Reals"
    assert result.conditions == []


def test_domain_returns_upper_real_valued_restriction() -> None:
    result = run(MathRequest(kind="math", operation="domain", expression="sqrt(1 - x)"))

    assert result.status == "verified"
    assert [condition.latex for condition in result.conditions] == ["x \\leq 1"]


def test_domain_keeps_disconnected_real_domains() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="domain",
            expression="sqrt(x * (x - 1))",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "Union(Interval(-oo, 0), Interval(1, oo))"
    assert result.conditions


def test_domain_reports_unsupported_domain(monkeypatch) -> None:
    def fail(*_args):
        raise NotImplementedError

    monkeypatch.setattr(algebra, "continuous_domain", fail)

    with pytest.raises(ValueError, match="Domain could not be determined"):
        run(MathRequest(kind="math", operation="domain", expression="sqrt(x)"))
