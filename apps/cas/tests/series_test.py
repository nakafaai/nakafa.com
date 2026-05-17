import pytest

from cas.engine import run
from cas.schema import MathRequest


def test_series_expansion() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="sin(x)",
            order=5,
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "x**3" in result.secondary.expression
    assert "x**5/120" in result.secondary.expression


def test_series_expansion_keeps_needed_taylor_term() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="sin(x)",
            order=6,
            point="0",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "x**5/120" in result.secondary.expression


def test_series_uses_default_order_when_omitted() -> None:
    result = run(MathRequest(kind="math", operation="series", expression="sin(x)"))

    assert result.status == "verified"
    assert result.secondary
    assert "x**5/120" in result.secondary.expression


def test_series_preserves_fractional_expansion_point() -> None:
    result = run(
        MathRequest(
            expression="sin(x)",
            kind="math",
            operation="series",
            order=4,
            point="1/2",
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert "x - 1/2" in result.secondary.expression


def test_series_respects_zero_order_expansion() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="exp(x)",
            order=0,
            variable="x",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "1 + O(x)"


def test_series_rejects_negative_order() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        run(
            MathRequest(
                kind="math",
                operation="series",
                expression="exp(x)",
                order=-1,
                variable="x",
            )
        )


def test_summation_and_product() -> None:
    summation = run(
        MathRequest(
            expression="x",
            kind="math",
            lower="1",
            operation="summation",
            upper="4",
            variable="x",
        )
    )
    product = run(
        MathRequest(
            expression="x",
            kind="math",
            lower="1",
            operation="product",
            upper="4",
            variable="x",
        )
    )

    assert summation.secondary
    assert summation.secondary.expression == "10"
    assert product.secondary
    assert product.secondary.expression == "24"
