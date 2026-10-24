import pytest
import sympy as sp

from cas import parse
from cas.schema import (
    MAX_COUNT_OPERAND,
    MAX_DEGREE,
    MAX_DENOMINATOR_DEGREE,
    MAX_EXPANSION_TERMS,
    MAX_EXPONENT,
    MAX_INTEGER_DIGITS,
)


@pytest.mark.parametrize(
    "text",
    [
        "x^71",
        "x ** 71",
        "x**+71",
        "x**((71))",
        "x ** -71",
        "(x+1)**(7*100)",
        "10**(10**9)",
        "2**(2**(2**5))",
        "x**(10**20)",
        "(x+y+z)**(7*100)",
        "x**100.0",
        "x**1e300",
    ],
)
def test_refuses_an_exponent_beyond_the_bound_however_it_is_written(text: str) -> None:
    with pytest.raises(ValueError, match=f"Exponents may be at most {MAX_EXPONENT}"):
        parse.expression(text)


@pytest.mark.parametrize(
    "text", ["x^70", "x**(7*10)", "x**-70", "x**(1/2)", "x**0.5", "2**(-70)", "2**x"]
)
def test_accepts_an_exponent_within_the_bound(text: str) -> None:
    assert parse.expression(text) is not None


def test_exponent_at_the_bound_has_the_value_sympy_gives() -> None:
    x = sp.Symbol("x")

    assert parse.expression("x^70") == x**MAX_EXPONENT
    assert parse.expression("x**(7*10)") == x**MAX_EXPONENT
    assert parse.expression("x**-70") == x ** (-MAX_EXPONENT)


def test_refuses_a_computed_integer_beyond_the_digit_bound() -> None:
    message = f"An integer may have at most {MAX_INTEGER_DIGITS} digits"

    with pytest.raises(ValueError, match=message):
        parse.expression("10**30")
    with pytest.raises(ValueError, match=message):
        parse.expression("1" * (MAX_INTEGER_DIGITS + 1))
    with pytest.raises(ValueError, match=message):
        parse.expression("(10**20/7)**3")


def test_accepts_a_computed_integer_at_the_digit_bound() -> None:
    assert parse.expression("10**29") == sp.Integer(10) ** 29
    assert parse.expression("(1/3)**5") == sp.Rational(1, 243)


@pytest.mark.parametrize(
    "text",
    [
        "factorial(51)",
        "51!",
        "factorial2(51)",
        "factorial(10**9)",
        "5!*factorial(51)",
    ],
)
def test_refuses_a_factorial_argument_beyond_the_count_bound(text: str) -> None:
    with pytest.raises(
        ValueError, match=f"Factorial arguments may be at most {MAX_COUNT_OPERAND}"
    ):
        parse.expression(text)


def test_accepts_a_factorial_argument_at_the_count_bound() -> None:
    assert parse.expression("factorial(50)") == sp.factorial(50)
    assert parse.expression("50!") == sp.factorial(50)


def test_leaves_a_symbolic_factorial_argument_to_sympy() -> None:
    n = sp.Symbol("n")

    assert parse.expression("factorial(n)") == sp.factorial(n)


def test_folds_a_float_without_a_digit_bound() -> None:
    assert parse.expression("2.0/4") == sp.Float(0.5)
    assert parse.expression("(-8)**(1/3)") == sp.Integer(-8) ** sp.Rational(1, 3)


def test_leaves_an_undefined_constant_to_sympy() -> None:
    assert parse.expression("1/0") == sp.zoo


@pytest.mark.parametrize("text", ["5 % 2", "~5", "factorial(n=5)"])
def test_refuses_an_operator_or_keyword_that_the_parser_does_not_allow(
    text: str,
) -> None:
    with pytest.raises(ValueError, match="Expression could not be parsed"):
        parse.expression(text)


def test_folds_a_difference_and_a_real_root_within_the_bounds() -> None:
    assert parse.expression("2**(3-1)") == sp.Integer(4)
    assert parse.expression("2**(1/3)") == sp.Integer(2) ** sp.Rational(1, 3)


@pytest.mark.parametrize(
    "text",
    [
        "((x+1)^70)^70",
        "((x+1)^70+1)^70",
        "(x+1)^70*(x+2)^70",
        "x^70*x",
    ],
)
def test_refuses_a_degree_beyond_the_bound(text: str) -> None:
    with pytest.raises(ValueError, match=f"degree may be at most {MAX_DEGREE}"):
        parse.expression(text)


@pytest.mark.parametrize("text", ["(x+y+z)^70", "(x+y+z+w)^30"])
def test_refuses_an_expansion_beyond_the_term_bound(text: str) -> None:
    with pytest.raises(
        ValueError, match=f"An expansion may have at most {MAX_EXPANSION_TERMS} terms"
    ):
        parse.expression(text)


@pytest.mark.parametrize(
    "text",
    [
        "(x+1)^70",
        "sin((x+1)^70)^70",
        "x^70*exp(x)",
        "(x+y+z)^20",
        "(x+y+z+w)^20",
        "(x+1)*(x+2)*(x+3)*(x+4)*(x+5)*(x+6)*(x+7)*(x+8)*(x+9)*(x+10)",
        "a*b*c*d*e*f*g*h*i*j",
    ],
)
def test_accepts_an_expansion_within_the_bounds(text: str) -> None:
    assert parse.expression(text) is not None


def test_a_bounded_false_read_leaves_sympy_output_to_sympy() -> None:
    x = sp.Symbol("x")

    assert parse.expression("((x+1)^70)^70", bounded=False) == (x + 1) ** 4900
    assert parse.expression("10**30", bounded=False) == sp.Integer(10) ** 30


def test_a_power_of_zero_is_a_constant_with_no_expansion() -> None:
    assert parse.expression("(x+1)^0") == sp.Integer(1)


@pytest.mark.parametrize("text", ["1/(x^7+1)", "1/(x^70+1)", "(x+1)/(x^2+1)^4"])
def test_refuses_a_denominator_beyond_the_degree_bound(text: str) -> None:
    with pytest.raises(
        ValueError,
        match=f"denominator may have degree at most {MAX_DENOMINATOR_DEGREE}",
    ):
        parse.expression(text)


def test_accepts_a_denominator_at_the_degree_bound() -> None:
    assert parse.expression("1/(x^6+1)") is not None
    assert parse.expression("x/(x^2+1)") is not None
