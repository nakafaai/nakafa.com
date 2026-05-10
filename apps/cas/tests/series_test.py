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
