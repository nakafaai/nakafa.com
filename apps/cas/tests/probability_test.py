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


def test_binomial_point_probability() -> None:
    result = run(
        MathRequest(
            distribution="binomial",
            kind="math",
            operation="point_probability",
            parameters={"n": "10", "p": "1/5"},
            point="3",
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.stepStatus == "complete"
    assert result.primary.expression == "P(X = 3)"
    assert result.secondary
    assert result.secondary.expression == "393216/1953125"


def test_normal_cumulative_probability() -> None:
    result = run(
        MathRequest(
            distribution="normal",
            kind="math",
            operation="cumulative_probability",
            parameters={"mean": "70", "standard_deviation": "10"},
            upper="85",
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.stepStatus == "complete"
    assert result.primary.expression == "P(X <= 85)"
    assert result.secondary
    assert result.secondary.expression == "1 - erfc(3*sqrt(2)/4)/2"


def test_normal_cumulative_probability_can_be_exclusive() -> None:
    result = run(
        MathRequest(
            distribution="normal",
            inclusive=False,
            kind="math",
            operation="cumulative_probability",
            parameters={"mean": "70", "standard_deviation": "10"},
            upper="85",
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.primary.expression == "P(X < 85)"
    assert result.secondary
    assert result.secondary.expression == "1 - erfc(3*sqrt(2)/4)/2"


def test_normal_interval_probability() -> None:
    result = run(
        MathRequest(
            distribution="normal",
            kind="math",
            lower="60",
            operation="interval_probability",
            parameters={"mean": "70", "standard_deviation": "10"},
            upper="85",
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.stepStatus == "complete"
    assert result.primary.expression == "P(60 <= X <= 85)"
    assert result.secondary
    assert result.secondary.expression == "erf(sqrt(2)/2)/2 + erf(3*sqrt(2)/4)/2"


def test_normal_interval_probability_can_use_open_bounds() -> None:
    result = run(
        MathRequest(
            distribution="normal",
            kind="math",
            lower="60",
            lowerInclusive=False,
            operation="interval_probability",
            parameters={"mean": "70", "standard_deviation": "10"},
            upper="85",
            upperInclusive=False,
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.primary.expression == "P(60 < X < 85)"
    assert result.secondary
    assert result.secondary.expression == "erf(sqrt(2)/2)/2 + erf(3*sqrt(2)/4)/2"


def test_poisson_tail_probability_defaults_to_inclusive() -> None:
    result = run(
        MathRequest(
            distribution="poisson",
            kind="math",
            lower="2",
            operation="tail_probability",
            parameters={"lambda": "3"},
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.primary.expression == "P(X >= 2)"
    assert result.secondary
    assert result.secondary.expression == "(-4 + exp(3))*exp(-3)"


def test_poisson_tail_probability_can_be_exclusive() -> None:
    result = run(
        MathRequest(
            distribution="poisson",
            inclusive=False,
            kind="math",
            lower="2",
            operation="tail_probability",
            parameters={"lambda": "3"},
            variable="X",
        )
    )

    assert result.status == "verified"
    assert result.stepStatus == "complete"
    assert result.primary.expression == "P(X > 2)"
    assert result.secondary
    assert result.secondary.expression == "(-17/2 + exp(3))*exp(-3)"


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
