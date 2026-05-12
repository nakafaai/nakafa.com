import pytest

from cas import stat
from cas.engine import run
from cas.schema import MathRequest


def test_mean() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="mean",
            values=["2", "4", "6"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "4"


@pytest.mark.parametrize(
    ("operation", "expected"),
    [
        ("median", "2"),
        ("variance", "2/3"),
        ("standard_deviation", "sqrt(6)/3"),
    ],
)
def test_statistics_with_single_outputs(operation: str, expected: str) -> None:
    result = run(
        MathRequest(
            kind="math",
            operation=operation,
            values=["1", "2", "3"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == expected


def test_even_median_mode_and_z_score() -> None:
    median = run(
        MathRequest(kind="math", operation="median", values=["1", "2", "3", "4"])
    )
    mode = run(MathRequest(kind="math", operation="mode", values=["1", "2", "2", "3"]))
    z_score = run(
        MathRequest(
            expression="3",
            kind="math",
            operation="z_score",
            values=["1", "2", "3"],
        )
    )

    assert median.secondary
    assert median.secondary.expression == "5/2"
    assert mode.items[0].value == "2"
    assert z_score.secondary
    assert z_score.secondary.expression == "sqrt(6)/2"


def test_quartiles() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="quartiles",
            values=["1", "2", "3", "4", "5"],
        )
    )

    assert result.status == "verified"
    assert [entry.value for entry in result.items] == ["3/2", "3", "9/2"]


def test_single_value_quartiles_use_the_only_value() -> None:
    result = run(MathRequest(kind="math", operation="quartiles", values=["5"]))

    assert result.status == "verified"
    assert [entry.value for entry in result.items] == ["5", "5", "5"]


def test_z_score_rejects_zero_variance() -> None:
    with pytest.raises(ValueError, match="variance is zero"):
        run(
            MathRequest(
                expression="5",
                kind="math",
                operation="z_score",
                values=["5", "5"],
            )
        )


def test_statistics_requires_values() -> None:
    with pytest.raises(ValueError, match="Values are required"):
        run(MathRequest(kind="math", operation="mean"))


def test_median_requires_values() -> None:
    with pytest.raises(ValueError, match="Median requires at least one value"):
        stat._median([])


def test_unknown_statistics_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported statistics operation"):
        stat.run(MathRequest(kind="math", operation="unknown", values=["1"]))
