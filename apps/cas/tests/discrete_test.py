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


@pytest.mark.parametrize(
    "math_request",
    [
        MathRequest(kind="math", k="2", n="5", operation="combination"),
        MathRequest(kind="math", operation="gcd", values=["18", "24"]),
        MathRequest(kind="math", n="21", operation="is_prime"),
        MathRequest(kind="math", operation="lcm", values=["6", "8"]),
        MathRequest(kind="math", modulus="5", n="17", operation="modular"),
        MathRequest(kind="math", k="2", n="5", operation="permutation"),
        MathRequest(kind="math", n="84", operation="prime_factorization"),
    ],
)
def test_discrete_steps_include_reasons(math_request: MathRequest) -> None:
    result = run(math_request)

    assert result.steps
    assert all(step.reason for step in result.steps)


@pytest.mark.parametrize(
    ("math_request", "expected_reasons"),
    [
        (
            MathRequest(kind="math", k="2", n="5", operation="combination"),
            [
                (
                    "combination",
                    "Use the combination formula because order does not matter.",
                ),
                ("evaluate", "Evaluate the factorials and simplify exactly."),
            ],
        ),
        (
            MathRequest(kind="math", k="2", n="5", operation="permutation"),
            [
                ("permutation", "Use the permutation formula because order matters."),
                ("evaluate", "Evaluate the factorials and simplify exactly."),
            ],
        ),
        (
            MathRequest(kind="math", modulus="30", n="84", operation="modular"),
            [
                (
                    "modular",
                    (
                        "Use the division algorithm; the remainder is the value "
                        "modulo the modulus."
                    ),
                )
            ],
        ),
        (
            MathRequest(kind="math", operation="gcd", values=["18", "24"]),
            [
                (
                    "gcd",
                    (
                        "Use Euclidean division; replacing the larger number by "
                        "the remainder preserves the gcd."
                    ),
                ),
                (
                    "gcd",
                    (
                        "Use Euclidean division; replacing the larger number by "
                        "the remainder preserves the gcd."
                    ),
                ),
                (
                    "gcd",
                    "When the remainder is 0, the last nonzero divisor is the gcd.",
                ),
            ],
        ),
        (
            MathRequest(kind="math", operation="lcm", values=["6", "8"]),
            [
                (
                    "lcm",
                    (
                        "Use the identity lcm(a, b) = |a*b| / gcd(a, b) for "
                        "two integers."
                    ),
                )
            ],
        ),
        (
            MathRequest(kind="math", n="21", operation="is_prime"),
            [("is_prime", "3 divides 21, so 21 is not prime.")],
        ),
        (
            MathRequest(kind="math", n="84", operation="prime_factorization"),
            [
                (
                    "prime_factorization",
                    (
                        "Break the integer into prime factors and combine repeated "
                        "primes as powers."
                    ),
                )
            ],
        ),
    ],
)
def test_discrete_step_reasons_match_operation_flow(
    math_request: MathRequest,
    expected_reasons: list[tuple[str, str]],
) -> None:
    result = run(math_request)

    assert [(step.action, step.reason) for step in result.steps] == expected_reasons


def test_combination_and_permutation_show_formula_substitution() -> None:
    combination = run(MathRequest(kind="math", k="2", n="5", operation="combination"))
    permutation = run(MathRequest(kind="math", k="2", n="5", operation="permutation"))

    assert [step.action for step in combination.steps] == ["combination", "evaluate"]
    assert combination.steps[0].secondary
    assert combination.steps[0].secondary.expression == "5!/(2!*3!)"
    assert [step.action for step in permutation.steps] == ["permutation", "evaluate"]
    assert permutation.steps[0].secondary
    assert permutation.steps[0].secondary.expression == "5!/3!"


def test_modular_step_keeps_division_algorithm_context() -> None:
    result = run(MathRequest(kind="math", modulus="30", n="84", operation="modular"))

    assert result.steps[0].items[0].label == "division"
    assert result.steps[0].items[0].value == "84 = 2*30 + 24"


def test_lcm_step_keeps_identity_context() -> None:
    result = run(MathRequest(kind="math", operation="lcm", values=["6", "8"]))

    assert [(entry.label, entry.value) for entry in result.steps[0].items] == [
        ("gcd", "2"),
        ("identity", "|6*8|/gcd(6, 8)"),
    ]


def test_prime_reason_keeps_checked_divisors() -> None:
    result = run(MathRequest(kind="math", n="17", operation="is_prime"))

    assert result.steps[0].reason == (
        "No prime divisor up to sqrt(17) divides 17, so it is prime."
    )
    assert result.steps[0].items[0].label == "checked_divisors"
    assert result.steps[0].items[0].value == "2, 3"


@pytest.mark.parametrize(
    ("value", "expected_reason", "expected_items"),
    [
        ("1", "Prime numbers are integers greater than 1.", []),
        ("2", "2 has exactly two positive divisors: 1 and 2.", []),
        ("21", "3 divides 21, so 21 is not prime.", [("divisor", "3")]),
    ],
)
def test_primality_reasons_cover_definition_and_composite_evidence(
    value: str,
    expected_reason: str,
    expected_items: list[tuple[str, str]],
) -> None:
    result = run(MathRequest(kind="math", n=value, operation="is_prime"))

    assert result.steps[0].reason == expected_reason
    assert [(entry.label, entry.value) for entry in result.steps[0].items] == (
        expected_items
    )


def test_prime_factorization() -> None:
    result = run(MathRequest(kind="math", n="84", operation="prime_factorization"))

    assert result.secondary
    assert result.secondary.expression == "2^2*3*7"
    assert result.items
    assert [entry.value for entry in result.items] == ["2^2", "3", "7"]
    assert [entry.latex for entry in result.items] == ["2^{2}", "3", "7"]


def test_prime_factorization_of_one() -> None:
    result = run(MathRequest(kind="math", n="1", operation="prime_factorization"))

    assert result.secondary
    assert result.secondary.expression == "1"
    assert result.secondary.latex == "1"


def test_prime_factorization_keeps_negative_sign_first() -> None:
    result = run(MathRequest(kind="math", n="-12", operation="prime_factorization"))

    assert result.secondary
    assert result.secondary.expression == "-1*2^2*3"


def test_prime_factorization_of_negative_one_explains_sign_unit() -> None:
    result = run(MathRequest(kind="math", n="-1", operation="prime_factorization"))

    assert result.steps[0].reason == (
        "-1 is the sign unit and has no positive prime factors."
    )


def test_prime_factorization_rejects_zero() -> None:
    with pytest.raises(ValueError, match="nonzero integer"):
        run(MathRequest(kind="math", n="0", operation="prime_factorization"))


def test_gcd_with_more_than_two_values_uses_function_notation() -> None:
    result = run(MathRequest(kind="math", operation="gcd", values=["84", "30", "6"]))

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "6"
    assert result.stepStatus == "complete"
    assert result.steps[0].primary.expression == "gcd(84, 30, 6)"


@pytest.mark.parametrize(
    ("operation", "values", "expected", "expected_reason"),
    [
        (
            "gcd",
            ["0", "0"],
            "0",
            "The gcd of two zeros is 0 in this exact integer convention.",
        ),
        (
            "gcd",
            ["18", "0"],
            "18",
            "The gcd of an integer and 0 is the integer's absolute value.",
        ),
        (
            "lcm",
            ["0", "0"],
            "0",
            (
                "Both inputs are zero, so the least common multiple is 0 in this "
                "exact integer convention."
            ),
        ),
        (
            "lcm",
            ["6", "8", "12"],
            "24",
            "Reduce the integer list using the associative lcm operation.",
        ),
    ],
)
def test_gcd_and_lcm_special_cases_explain_their_conventions(
    operation: str,
    values: list[str],
    expected: str,
    expected_reason: str,
) -> None:
    result = run(MathRequest(kind="math", operation=operation, values=values))

    assert result.secondary
    assert result.secondary.expression == expected
    assert result.steps[0].reason == expected_reason


@pytest.mark.parametrize(
    "math_request",
    [
        MathRequest(kind="math", n="2.9", operation="is_prime"),
        MathRequest(kind="math", operation="gcd", values=["3/2", "2"]),
    ],
)
def test_discrete_operands_reject_non_integers(math_request: MathRequest) -> None:
    with pytest.raises(ValueError, match="must be integers"):
        run(math_request)


def test_modular_rejects_zero_modulus() -> None:
    with pytest.raises(ValueError, match="Modulus must be nonzero"):
        run(MathRequest(kind="math", modulus="0", n="84", operation="modular"))


def test_discrete_value_operations_require_values() -> None:
    with pytest.raises(ValueError, match="at least one integer"):
        run(MathRequest(kind="math", operation="gcd"))


@pytest.mark.parametrize(
    "math_request",
    [
        MathRequest(kind="math", k="5", n="3", operation="permutation"),
        MathRequest(kind="math", k="-1", n="3", operation="permutation"),
    ],
)
def test_permutation_rejects_invalid_bounds(math_request: MathRequest) -> None:
    with pytest.raises(ValueError, match="0 <= k <= n"):
        run(math_request)


def test_unknown_discrete_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported discrete operation"):
        discrete.run(MathRequest(kind="math", operation="unknown"))
