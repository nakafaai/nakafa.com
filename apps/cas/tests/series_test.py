import pytest

from cas.engine import run
from cas.schema import (
    MAX_SERIES_ORDER,
    MAX_SUMMATION_TERMS,
    MAX_TRANSCENDENTAL_SERIES_ORDER,
    MathRequest,
)


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


def test_series_refuses_a_transcendental_order_beyond_the_bound() -> None:
    with pytest.raises(ValueError, match="transcendental function may be at most"):
        run(
            MathRequest(
                kind="math",
                operation="series",
                expression="exp(sin(x))",
                order=MAX_TRANSCENDENTAL_SERIES_ORDER + 1,
            )
        )


def test_series_accepts_a_transcendental_order_at_the_bound() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="sin(x)",
            order=MAX_TRANSCENDENTAL_SERIES_ORDER,
        )
    )

    assert result.status == "verified"


def test_series_keeps_a_rational_order_at_the_series_bound() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="series",
            expression="1/(1+x^2+x^3)",
            order=MAX_SERIES_ORDER,
        )
    )

    assert result.status == "verified"


def test_summation_accepts_a_range_at_the_term_bound() -> None:
    result = run(
        MathRequest(
            kind="math",
            operation="summation",
            expression="x",
            variable="x",
            lower="1",
            upper=str(MAX_SUMMATION_TERMS),
        )
    )

    assert result.secondary is not None
    assert result.secondary.expression == str(
        MAX_SUMMATION_TERMS * (MAX_SUMMATION_TERMS + 1) // 2
    )


def test_summation_refuses_a_range_beyond_the_term_bound() -> None:
    with pytest.raises(ValueError, match="summation or product may have at most"):
        run(
            MathRequest(
                kind="math",
                operation="summation",
                expression="1/x",
                variable="x",
                lower="1",
                upper=str(MAX_SUMMATION_TERMS + 1),
            )
        )


def test_product_refuses_a_range_beyond_the_term_bound() -> None:
    with pytest.raises(ValueError, match="summation or product may have at most"):
        run(
            MathRequest(
                kind="math",
                operation="product",
                expression="1+1/x",
                variable="x",
                lower="1",
                upper=str(MAX_SUMMATION_TERMS + 1),
            )
        )
