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


def test_solve_trig_equation_returns_full_real_solution_set() -> None:
    result = run(
        MathRequest(
            expression="sin(x) = 0",
            kind="math",
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "ImageSet" in result.secondary.expression
    assert "Integers" in result.secondary.expression


def test_solve_returns_inconclusive_for_transcendental_condition_sets() -> None:
    result = run(
        MathRequest(
            expression="sin(x) = x",
            kind="math",
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The equation solution set could not be determined exactly."


def test_solve_returns_inconclusive_for_unrepresented_product_solution_set() -> None:
    result = run(
        MathRequest(
            expression="x^x * (ln(x) + 1) = 0",
            kind="math",
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.primary.expression == "Eq(x**x*(log(x) + 1), 0)"


def test_solve_product_equation_uses_positive_domain() -> None:
    result = run(
        MathRequest(
            expression="x^x * (ln(x) + 1) = 0",
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "{exp(-1)}"
    assert result.input.lower == "0"
    assert result.input.lowerInclusive is False
    assert result.steps[0].action == "solve"


def test_solve_filters_polynomial_solutions_by_domain() -> None:
    result = run(
        MathRequest(
            expression="x^2 - 1 = 0",
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "[1]"


def test_solve_returns_inconclusive_for_symbolic_domain_membership() -> None:
    result = run(
        MathRequest(
            expression="x - a = 0",
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The equation solution set could not be determined exactly."


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


def test_solve_infers_single_symbol_when_variable_is_omitted() -> None:
    result = run(
        MathRequest(
            expression="y^2 = 4",
            kind="math",
            operation="solve",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "[-2, 2]"


def test_solve_rejects_ambiguous_symbols_when_variable_is_omitted() -> None:
    with pytest.raises(ValueError, match="Variable is required"):
        run(
            MathRequest(
                expression="x + y = 1",
                kind="math",
                operation="solve",
            )
        )


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


def test_solve_inequality_system() -> None:
    result = run(
        MathRequest(
            expressions=["x > 0", "x < 2"],
            kind="math",
            operation="solve",
            variable="x",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "(0 < x) & (x < 2)"
    assert result.stepStatus == "partial"
    assert result.steps[0].action == "solve"


def test_solve_inequality_intersects_requested_domain() -> None:
    result = run(
        MathRequest(
            expression="x^2 < 4",
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "(0 < x) & (x < 2)"


def test_solve_inequality_intersects_domain_with_inferred_variable() -> None:
    result = run(
        MathRequest(
            expressions=["y^2 < 4"],
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variables=["y"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "(0 < y) & (y < 2)"


def test_solve_inequality_system_intersects_requested_domain() -> None:
    result = run(
        MathRequest(
            expressions=["x > 0", "x < 2"],
            kind="math",
            lower="1",
            lowerInclusive=False,
            operation="solve",
            variable="x",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "(1 < x) & (x < 2)"


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


def test_solve_system_filters_solutions_by_requested_domain() -> None:
    result = run(
        MathRequest(
            expressions=["x^2 - 1 = 0", "y = 0"],
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
            variables=["x", "y"],
        )
    )

    assert result.status == "verified"
    assert [item.value for item in result.items] == ["{x: 1, y: 0}"]


def test_solve_system_requires_domain_variable_for_requested_domain() -> None:
    with pytest.raises(ValueError, match="Domain variable is required"):
        run(
            MathRequest(
                expressions=["x^2 - 1 = 0", "y = 0"],
                kind="math",
                lower="0",
                lowerInclusive=False,
                operation="solve",
                variables=["x", "y"],
            )
        )


def test_solve_system_requires_full_variables_for_requested_domain() -> None:
    with pytest.raises(ValueError, match="include a solved variable"):
        run(
            MathRequest(
                expressions=["x + y = 3", "y = 1"],
                kind="math",
                lower="0",
                operation="solve",
                variable="x",
            )
        )

    with pytest.raises(ValueError, match="include a solved variable"):
        run(
            MathRequest(
                expressions=["x = 2", "y = 1"],
                kind="math",
                lower="0",
                operation="solve",
                variable="x",
                variables=["x"],
            )
        )


def test_solve_system_allows_symbolic_parameters_for_requested_domain() -> None:
    result = run(
        MathRequest(
            expressions=["a*x = 1", "2*x = 2/a"],
            kind="math",
            lower="0",
            lowerInclusive=False,
            operation="solve",
            variable="x",
            variables=["x"],
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The equation solution set could not be determined exactly."


def test_solve_system_allows_supported_functions_for_requested_domain() -> None:
    result = run(
        MathRequest(
            expressions=["Rational(1, 2)*x = 1", "2*x = 4"],
            kind="math",
            lower="0",
            operation="solve",
            variable="x",
            variables=["x"],
        )
    )

    assert result.status == "verified"
    assert [item.value for item in result.items] == ["{x: 2}"]


def test_solve_system_rejects_domain_variable_outside_solved_variables() -> None:
    with pytest.raises(ValueError, match="one of the solved variables"):
        run(
            MathRequest(
                expressions=["x^2 - 1 = 0", "y = 0"],
                kind="math",
                lower="0",
                operation="solve",
                variable="z",
                variables=["x", "y"],
            )
        )


def test_solve_inequality_rejects_mismatched_domain_variable() -> None:
    with pytest.raises(ValueError, match="one of the solved variables"):
        run(
            MathRequest(
                expressions=["y > 0"],
                kind="math",
                lower="0",
                operation="solve",
                variable="x",
                variables=["y"],
            )
        )


def test_solve_inequality_system_rejects_mismatched_domain_variable() -> None:
    with pytest.raises(ValueError, match="one of the solved variables"):
        run(
            MathRequest(
                expressions=["y > 0", "y < 2"],
                kind="math",
                lower="0",
                operation="solve",
                variable="x",
                variables=["y"],
            )
        )


def test_solve_system_returns_inconclusive_when_domain_value_is_not_solved() -> None:
    result = run(
        MathRequest(
            expressions=["y = 0"],
            kind="math",
            lower="0",
            operation="solve",
            variable="x",
            variables=["x", "y"],
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The equation solution set could not be determined exactly."


def test_solve_system_returns_inconclusive_for_non_mapping_solve_outputs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def solve_non_mapping(*_args: object, **_kwargs: object) -> object:
        return object()

    monkeypatch.setattr("cas.equation.sp.solve", solve_non_mapping)

    result = run(
        MathRequest(
            expressions=["x + y = 3", "x - y = 1"],
            kind="math",
            operation="solve",
            variables=["x", "y"],
        )
    )

    assert result.status == "inconclusive"
    assert result.reason == "The equation solution set could not be determined exactly."


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


def test_roots_infers_single_symbol_when_variable_is_omitted() -> None:
    result = run(
        MathRequest(
            expression="y^2 - 4 = 0",
            kind="math",
            operation="roots",
        )
    )

    assert result.status == "verified"
    assert {root.value for root in result.items} == {"-2: 1", "2: 1"}


def test_roots_rejects_solve_domain_bounds() -> None:
    with pytest.raises(ValueError, match="solve-domain bounds"):
        run(
            MathRequest(
                expression="x^2 - 1 = 0",
                kind="math",
                lower="0",
                operation="roots",
                variable="x",
            )
        )


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


def test_roots_rejects_non_polynomial_equation() -> None:
    with pytest.raises(ValueError, match="polynomial expression or equation"):
        run(
            MathRequest(
                kind="math",
                operation="roots",
                expression="sin(x) = 0",
                variable="x",
            )
        )


def test_roots_rejects_empty_symbolic_result() -> None:
    with pytest.raises(ValueError, match="could not be expressed exactly"):
        run(
            MathRequest(
                kind="math",
                operation="roots",
                expression="x^7 - 3*x^2 + 1 = 0",
                variable="x",
            )
        )


def test_roots_rejects_partial_symbolic_result() -> None:
    with pytest.raises(ValueError, match="could not be expressed exactly"):
        run(
            MathRequest(
                kind="math",
                operation="roots",
                expression="(x - 1) * (x^5 - x + 1) = 0",
                variable="x",
            )
        )
