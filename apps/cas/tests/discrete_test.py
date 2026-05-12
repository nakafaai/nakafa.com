import pytest

from cas import discrete
from cas.engine import run
from cas.schema import MathRequest


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


@pytest.mark.parametrize(
    ("math_request", "expected_latex"),
    [
        (
            MathRequest(kind="math", modulus="30", n="84", operation="modular"),
            "84 \\bmod 30",
        ),
        (
            MathRequest(kind="math", k="2", n="5", operation="combination"),
            "\\binom{5}{2}",
        ),
        (
            MathRequest(kind="math", k="2", n="5", operation="permutation"),
            "P\\left(5, 2\\right)",
        ),
    ],
)
def test_discrete_steps_preserve_operation_context(
    math_request: MathRequest, expected_latex: str
) -> None:
    result = run(math_request)

    assert result.stepStatus == "complete"
    assert result.steps
    assert result.steps[0].primary.latex == expected_latex


def test_prime_factorization() -> None:
    result = run(MathRequest(kind="math", n="84", operation="prime_factorization"))

    assert result.secondary
    assert result.secondary.expression == "2^2*3*7"
    assert result.items
    assert [entry.value for entry in result.items] == ["2^2", "3^1", "7^1"]


def test_gcd_with_more_than_two_values_uses_function_notation() -> None:
    result = run(MathRequest(kind="math", operation="gcd", values=["84", "30", "6"]))

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "6"
    assert result.stepStatus == "complete"
    assert result.steps[0].primary.expression == "gcd(84, 30, 6)"


def test_unknown_discrete_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported discrete operation"):
        discrete.run(MathRequest(kind="math", operation="unknown"))
