import pytest
import sympy as sp

from cas import parse


def test_parse_defaults_and_errors() -> None:
    assert parse.symbol(None).name == "x"
    assert [symbol.name for symbol in parse.symbols([])] == ["x"]

    with pytest.raises(ValueError, match="Expression is required"):
        parse.expression(None)
    with pytest.raises(ValueError, match="Equation is required"):
        parse.equation(None)
    with pytest.raises(ValueError, match="Matrix is required"):
        parse.matrix([])
    with pytest.raises(ValueError, match="Vector is required"):
        parse.vector([])


@pytest.mark.parametrize(
    "equation", ["x <= 1", "x >= 1", "x < 1", "x > 1", "x = 1", "x - 1"]
)
def test_parse_equation_variants(equation: str) -> None:
    assert parse.equation(equation) is not None


def test_parse_lowercase_e_as_euler_constant() -> None:
    x = sp.Symbol("x")

    assert parse.expression("e^x") == sp.E**x
