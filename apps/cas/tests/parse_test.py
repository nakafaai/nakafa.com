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


def test_parse_factorial_notation() -> None:
    assert parse.expression("factorial(5)") == sp.Integer(120)
    assert parse.expression("5!") == sp.Integer(120)


def test_parse_allows_python_keyword_symbol_names() -> None:
    symbol = sp.Symbol("lambda")

    assert parse.expression("2 - lambda") == 2 - symbol
    assert parse.matrix([["2-lambda", "1"], ["1", "2-lambda"]]).det() == (
        sp.expand((2 - symbol) ** 2 - 1)
    )


def test_parse_rejects_unknown_functions() -> None:
    with pytest.raises(ValueError, match="Expression could not be parsed"):
        parse.expression("foo(5)")


def test_parse_keeps_implicit_multiplication_without_splitting_words() -> None:
    x = sp.Symbol("x")

    assert parse.expression("2x") == 2 * x
    assert parse.expression("x y") == x * sp.Symbol("y")
    assert parse.expression("xy") == sp.Symbol("xy")
