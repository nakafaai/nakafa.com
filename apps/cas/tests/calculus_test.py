import pytest

from cas import calculus
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


def test_differentiate_infers_single_symbol_when_variable_is_omitted() -> None:
    result = run(
        MathRequest(
            expression="y^3",
            kind="math",
            operation="differentiate",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "3*y**2"


def test_differentiate_defaults_to_x_for_constant_expressions() -> None:
    result = run(
        MathRequest(
            expression="2",
            kind="math",
            operation="differentiate",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "0"


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


def test_integrate_uses_reflection_for_log_tangent_integral() -> None:
    result = run(
        MathRequest(
            expression="log(1 + tan(theta))",
            kind="math",
            lower="0",
            operation="integrate",
            upper="pi/4",
            variable="theta",
        )
    )

    assert result.status == "verified"
    assert (
        result.primary.expression == "Integral(log(tan(theta) + 1), (theta, 0, pi/4))"
    )
    assert result.secondary
    assert result.secondary.expression == "pi*log(2)/8"
    assert [step.action for step in result.steps] == ["integrate-symmetry"]


def test_integrate_uses_arctangent_reflection_for_rational_log_integral() -> None:
    result = run(
        MathRequest(
            expression="log(1 + x)/(1 + x^2)",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "pi*log(2)/8"
    assert [step.action for step in result.steps] == [
        "substitute",
        "integrate-symmetry",
    ]


def test_integrate_rejects_divergent_symmetric_integral() -> None:
    result = run(
        MathRequest(
            expression="1/x",
            kind="math",
            lower="-1",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.secondary is None
    assert result.steps == []


def test_integrate_keeps_existing_substitution_symbol_as_parameter() -> None:
    result = run(
        MathRequest(
            expression="theta + theta_sub + log(1 + x)/(1 + x^2)",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "theta + theta_sub + pi*log(2)/8"
    assert result.steps[0].action == "integrate-sum"


def test_integrate_keeps_numbered_substitution_symbols_as_parameters() -> None:
    result = run(
        MathRequest(
            expression="theta + theta_1 + theta_2 + log(1 + x)/(1 + x^2)",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "theta + theta_1 + theta_2 + pi*log(2)/8"


def test_integrate_termwise_handles_parameterized_linear_terms() -> None:
    result = run(
        MathRequest(
            expression="a + x",
            kind="math",
            lower="0",
            operation="integrate",
            upper="2",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "2*a + 2"
    assert result.steps[0].action == "integrate-symmetry"


def test_integrate_falls_back_to_generic_for_single_parameterized_term() -> None:
    result = run(
        MathRequest(
            expression="a*x^2",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "a/3"
    assert result.steps[0].action == "integrate"


def test_integrate_termwise_uses_generic_for_supported_terms() -> None:
    result = run(
        MathRequest(
            expression="a + x^2",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "a + 1/3"
    assert result.steps[0].action == "integrate-sum"


def test_integrate_termwise_uses_reflection_for_supported_terms() -> None:
    result = run(
        MathRequest(
            expression="a + x + x^2",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "a + 5/6"


def test_integrate_termwise_rejects_unsupported_terms() -> None:
    result = run(
        MathRequest(
            expression="a + x^x",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.secondary is None


def test_integrate_uses_generic_for_symbolic_bounds() -> None:
    result = run(
        MathRequest(
            expression="sin(x)",
            kind="math",
            lower="a",
            operation="integrate",
            upper="b",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "cos(a) - cos(b)"


def test_integrate_uses_generic_when_continuity_cannot_be_checked(monkeypatch) -> None:
    def fail_continuity(*_args) -> None:
        raise NotImplementedError

    monkeypatch.setattr(calculus, "continuous_domain", fail_continuity)

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
    assert result.steps[0].action == "integrate"


def test_integrate_handles_reversed_reflection_bounds() -> None:
    result = run(
        MathRequest(
            expression="log(1 + tan(theta))",
            kind="math",
            lower="pi/4",
            operation="integrate",
            upper="0",
            variable="theta",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "-pi*log(2)/8"


def test_fresh_symbol_skips_numbered_symbol_collisions() -> None:
    theta = calculus.sp.Symbol("theta")
    theta_one = calculus.sp.Symbol("theta_1")

    assert calculus._fresh_symbol("theta", {theta, theta_one}) == calculus.sp.Symbol(
        "theta_2"
    )


def test_integrate_uses_fresh_substitution_symbol_when_theta_is_taken() -> None:
    result = run(
        MathRequest(
            expression="log(1 + theta)/(1 + theta^2)",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="theta",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "pi*log(2)/8"


def test_integrate_uses_generic_integrate_when_log_reflection_is_not_constant() -> None:
    result = run(
        MathRequest(
            expression="x + log(x + 2)",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "-2*log(2) - 1/2 + 3*log(3)"
    assert [step.action for step in result.steps] == ["integrate"]


def test_integrate_returns_inconclusive_for_unevaluated_result() -> None:
    result = run(
        MathRequest(
            expression="x^x",
            kind="math",
            lower="0",
            operation="integrate",
            upper="1",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.secondary is None
    assert result.steps == []
    assert result.reason == "The integral could not be determined exactly."


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


def test_limit_returns_inconclusive_for_unsupported_symbolic_case() -> None:
    result = run(
        MathRequest(
            expression="(-1)^(n + 1) / n",
            kind="math",
            operation="limit",
            point="oo",
            variable="n",
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The two-sided limit could not be determined exactly."


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
