"""Refuse parsed expressions whose values or expansions SymPy would compute too large.

SymPy evaluates a constant power, factorial, or sum as soon as it builds the
expression, and it expands a power of a sum when it is asked to. A bound on the text
is not enough: `10**(10**9)` is short and huge, and `((x+1)**70+1)**70` is short and
has degree 4900. This module reads the parsed Python AST before SymPy builds
anything, and refuses a value or shape that breaks a bound from cas/schema.py.
"""

import ast
from fractions import Fraction
from math import comb
from typing import NamedTuple, TypeGuard

from cas.schema import (
    MAX_COUNT_OPERAND,
    MAX_DEGREE,
    MAX_DENOMINATOR_DEGREE,
    MAX_EXPANSION_TERMS,
    MAX_EXPONENT,
    MAX_INTEGER_DIGITS,
)

Number = int | Fraction | float

FACTORIAL_FUNCTIONS = frozenset({"factorial", "factorial2"})
CONSTANT_NAMES = frozenset({"E", "e", "I", "oo", "pi"})
# One term above the bound is enough to refuse, so larger counts stay small integers.
TERM_CAP = MAX_EXPANSION_TERMS + 1


class Shape(NamedTuple):
    """An upper bound on the expansion of a subtree: its degree, terms, and symbols."""

    degree: int
    terms: int
    symbols: frozenset[str]


CONSTANT_SHAPE = Shape(degree=0, terms=1, symbols=frozenset())


def refuse_beyond_work_bounds(node: ast.AST) -> None:
    """Check a parsed expression and raise ValueError at the first bound it breaks."""
    _fold(node)
    _refuse_large_expansion(_shape(node))


def _fold(node: ast.AST) -> Number | None:
    """Return the value of a constant subtree and check every node beneath it."""
    if isinstance(node, ast.Constant):
        value = _literal(node.value)
    elif isinstance(node, ast.UnaryOp):
        value = _unary(node.op, _fold(node.operand))
    elif isinstance(node, ast.BinOp):
        left = _fold(node.left)
        right = _fold(node.right)
        if isinstance(node.op, ast.Pow) and right is not None:
            _refuse_large_exponent(right)
        value = _binary(node.op, left, right)
    elif isinstance(node, ast.Call):
        _fold_call(node)
        value = None
    else:
        for child in ast.iter_child_nodes(node):
            _fold(child)
        value = None

    if value is not None:
        _refuse_large_constant(value)

    return value


def _fold_call(node: ast.Call) -> None:
    """Check the operands of a call, and the argument of a factorial call."""
    _fold(node.func)
    arguments = [_fold(argument) for argument in node.args]
    for keyword in node.keywords:
        _fold(keyword.value)

    if (
        isinstance(node.func, ast.Name)
        and node.func.id in FACTORIAL_FUNCTIONS
        and arguments
        and arguments[0] is not None
    ):
        _refuse_large_factorial(arguments[0])


def _literal(value: object) -> Number | None:
    """Read one numeric literal. Booleans and text have no value for the bounds."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None

    return value


def _unary(operator: ast.unaryop, operand: Number | None) -> Number | None:
    """Apply unary plus or minus to a known value."""
    if operand is None:
        return None
    if isinstance(operator, ast.USub):
        return -operand
    if isinstance(operator, ast.UAdd):
        return operand

    return None


def _binary(
    operator: ast.operator, left: Number | None, right: Number | None
) -> Number | None:
    """Apply one arithmetic operator to known values. A failed fold has no value."""
    if left is None or right is None:
        return None

    try:
        if isinstance(operator, ast.Add):
            return left + right
        if isinstance(operator, ast.Sub):
            return left - right
        if isinstance(operator, ast.Mult):
            return left * right
        if isinstance(operator, ast.Div):
            return _divide(left, right)
        if isinstance(operator, ast.Pow):
            return _power(left, right)
    except (ArithmeticError, ValueError):
        # A fold that cannot finish has no value here; SymPy reports it as before.
        return None

    return None


def _divide(left: Number, right: Number) -> Number:
    """Divide exactly when both operands are integers or fractions."""
    if _is_exact(left) and _is_exact(right):
        return Fraction(left) / Fraction(right)

    return left / right


def _power(base: Number, exponent: Number) -> Number | None:
    """Raise a known value to a known exponent, which the caller has bounded."""
    if _is_exact(base) and _is_exact(exponent) and exponent.denominator == 1:
        return Fraction(base) ** int(exponent)

    result = float(base) ** float(exponent)
    if isinstance(result, complex):
        return None

    return result


def _is_exact(value: Number) -> TypeGuard[int | Fraction]:
    """Return whether a value is an integer or a fraction, not a float."""
    return isinstance(value, int | Fraction)


def _refuse_large_exponent(exponent: Number) -> None:
    """Refuse a power whose exponent magnitude is beyond the bound."""
    if abs(exponent) > MAX_EXPONENT:
        raise ValueError(f"Exponents may be at most {MAX_EXPONENT}.")


def _refuse_large_factorial(argument: Number) -> None:
    """Refuse a factorial whose argument is beyond the count bound."""
    if abs(argument) > MAX_COUNT_OPERAND:
        raise ValueError(f"Factorial arguments may be at most {MAX_COUNT_OPERAND}.")


def _refuse_large_constant(value: Number) -> None:
    """Refuse an exact value with more digits than an integer may have."""
    if not _is_exact(value):
        return

    fraction = Fraction(value)
    digits = max(
        len(str(abs(fraction.numerator))),
        len(str(fraction.denominator)),
    )
    if digits > MAX_INTEGER_DIGITS:
        raise ValueError(f"An integer may have at most {MAX_INTEGER_DIGITS} digits.")


def _shape(node: ast.AST) -> Shape:
    """Bound the degree, the expanded term count, and the symbols of a subtree."""
    if isinstance(node, ast.Constant):
        return CONSTANT_SHAPE
    if isinstance(node, ast.Name):
        if node.id in CONSTANT_NAMES:
            return CONSTANT_SHAPE
        return Shape(degree=1, terms=1, symbols=frozenset({node.id}))
    if isinstance(node, ast.UnaryOp):
        return _shape(node.operand)
    if isinstance(node, ast.BinOp):
        return _binary_shape(node)
    if isinstance(node, ast.Call):
        arguments = _combine([_shape(argument) for argument in node.args])
        # SymPy does not expand a function of a polynomial, so the value is one term of
        # degree zero. Its symbols still count, because they set the cost of a result.
        return Shape(degree=0, terms=1, symbols=arguments.symbols)

    return _combine([_shape(child) for child in ast.iter_child_nodes(node)])


def _binary_shape(node: ast.BinOp) -> Shape:
    """Bound one arithmetic operation from the shapes of its operands."""
    left = _shape(node.left)
    if isinstance(node.op, ast.Pow):
        return _power_shape(node.right, left)

    right = _shape(node.right)
    symbols = left.symbols | right.symbols
    if isinstance(node.op, ast.Div) and right.degree > MAX_DENOMINATOR_DEGREE:
        # SymPy's rational integration and partial fractions cost grows with the
        # roots of the denominator: 1/(x**8+1) takes 4 s, and 1/(x**70+1) never ends.
        raise ValueError(
            f"A denominator may have degree at most {MAX_DENOMINATOR_DEGREE}."
        )
    if isinstance(node.op, ast.Mult | ast.Div):
        # A quotient is bounded like a product, because SymPy may expand its numerator.
        return Shape(
            left.degree + right.degree, _cap(left.terms * right.terms), symbols
        )

    return Shape(
        max(left.degree, right.degree), _cap(left.terms + right.terms), symbols
    )


def _power_shape(exponent_node: ast.AST, base: Shape) -> Shape:
    """Bound a power. SymPy expands an integer power of a sum, and keeps the rest."""
    exponent = _fold(exponent_node)
    symbols = base.symbols | _shape(exponent_node).symbols
    if exponent is None or not _is_exact(exponent) or exponent.denominator != 1:
        # A symbolic or fractional power is kept unexpanded, so only its symbols count.
        return Shape(base.degree, base.terms, symbols)

    count = abs(int(exponent))
    if count == 0:
        return CONSTANT_SHAPE

    # The terms of (sum of `terms` terms) to the power `count` are at most this many.
    return Shape(
        count * base.degree,
        _cap(comb(base.terms + count - 1, count)),
        symbols,
    )


def _combine(shapes: list[Shape]) -> Shape:
    """Join subtrees that sit side by side: the largest degree, the sum of terms."""
    return Shape(
        degree=max((shape.degree for shape in shapes), default=0),
        terms=_cap(sum(shape.terms for shape in shapes)),
        symbols=frozenset().union(*(shape.symbols for shape in shapes)),
    )


def _cap(terms: int) -> int:
    """Keep a term count at one above the bound, which already refuses it."""
    return min(terms, TERM_CAP)


def _refuse_large_expansion(shape: Shape) -> None:
    """Refuse a degree beyond the bound, or an expansion with too many monomials."""
    if shape.degree > MAX_DEGREE:
        raise ValueError(f"A polynomial's degree may be at most {MAX_DEGREE}.")

    # A polynomial in n symbols of degree d has at most C(d + n, n) monomials.
    symbol_count = len(shape.symbols)
    monomials = comb(shape.degree + symbol_count, symbol_count)
    if min(shape.terms, monomials) > MAX_EXPANSION_TERMS:
        raise ValueError(f"An expansion may have at most {MAX_EXPANSION_TERMS} terms.")
