import pytest

from cas import probability
from cas.engine import run
from cas.schema import MathRequest


def test_binomial_expected_value() -> None:
    result = run(
        MathRequest(
            distribution="binomial",
            kind="math",
            operation="expected_value",
            parameters={"n": "10", "p": "1/2"},
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "5"


@pytest.mark.parametrize(
    ("distribution", "parameters"),
    [
        ("bernoulli", {"p": "1/3"}),
        ("normal", {"mean": "0", "standard_deviation": "2"}),
        ("poisson", {"lambda": "4"}),
        ("uniform", {"lower": "0", "upper": "5"}),
    ],
)
def test_supported_distributions(distribution: str, parameters: dict[str, str]) -> None:
    result = run(
        MathRequest(
            distribution=distribution,
            kind="math",
            operation="distribution",
            parameters=parameters,
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.secondary


def test_probability_variance() -> None:
    result = run(
        MathRequest(
            distribution="binomial",
            kind="math",
            operation="variance_probability",
            parameters={"n": "6", "p": "1/2"},
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "3/2"


def test_normal_distribution_accepts_documented_standard_deviation() -> None:
    result = run(
        MathRequest(
            distribution="normal",
            kind="math",
            operation="variance_probability",
            parameters={"mean": "0", "standardDeviation": "2"},
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "4"


def test_unsupported_probability_distribution_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported distribution"):
        run(
            MathRequest(
                distribution="geometric",
                kind="math",
                operation="distribution",
                variable="X",
            )
        )


def test_distribution_rejects_missing_parameters() -> None:
    with pytest.raises(ValueError, match="poisson distribution requires parameter"):
        run(
            MathRequest(
                distribution="poisson",
                kind="math",
                operation="expected_value",
                variable="X",
            )
        )


def test_distribution_rejects_missing_aliased_parameters() -> None:
    with pytest.raises(ValueError, match="normal distribution requires parameter"):
        run(
            MathRequest(
                distribution="normal",
                kind="math",
                operation="variance_probability",
                parameters={"mean": "0"},
                variable="X",
            )
        )


def test_unknown_probability_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported probability operation"):
        probability.run(
            MathRequest(
                distribution="binomial",
                kind="math",
                operation="unknown",
                parameters={"n": "6", "p": "1/2"},
                variable="X",
            )
        )
