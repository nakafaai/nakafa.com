"""Safe SymPy parsing helpers for fixed CAS inputs."""

import sympy as sp
from sympy.core.relational import Relational
from sympy.parsing.sympy_parser import (
    convert_xor,
    function_exponentiation,
    implicit_application,
    implicit_multiplication,
    parse_expr,
    standard_transformations,
)

from cas.schema import MathRequest, PointInput

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication,
    implicit_application,
    function_exponentiation,
    convert_xor,
)

FUNCTIONS = {
    "Abs": sp.Abs,
    "E": sp.E,
    "e": sp.E,
    "I": sp.I,
    "acos": sp.acos,
    "asin": sp.asin,
    "atan": sp.atan,
    "cos": sp.cos,
    "exp": sp.exp,
    "factorial": sp.factorial,
    "factorial2": sp.factorial2,
    "ln": sp.log,
    "log": sp.log,
    "oo": sp.oo,
    "pi": sp.pi,
    "sin": sp.sin,
    "sqrt": sp.sqrt,
    "tan": sp.tan,
}

GLOBALS = {
    "__builtins__": {},
    "Add": sp.Add,
    "Float": sp.Float,
    "Integer": sp.Integer,
    "Mul": sp.Mul,
    "Pow": sp.Pow,
    "Rational": sp.Rational,
    "Symbol": sp.Symbol,
}


def symbol(name: str | None) -> sp.Symbol:
    """Parse one symbol name, defaulting to `x` for school algebra."""
    return sp.Symbol(name or "x")


def symbols(names: list[str]) -> list[sp.Symbol]:
    """Parse symbol names, defaulting to `x` when omitted."""
    if not names:
        return [sp.Symbol("x")]

    return [sp.Symbol(name) for name in names]


def expression(value: str | None, *, evaluate: bool = True) -> sp.Expr:
    """Parse a SymPy expression with a restricted global namespace."""
    if not value:
        raise ValueError("Expression is required.")

    try:
        parsed = parse_expr(
            value,
            global_dict=GLOBALS,
            local_dict=FUNCTIONS,
            transformations=TRANSFORMATIONS,
            evaluate=evaluate,
        )
    except (NameError, SyntaxError, TypeError, ValueError) as error:
        raise ValueError("Expression could not be parsed.") from error

    if not isinstance(parsed, sp.Expr):
        raise ValueError("Expression must be one mathematical value.")

    return parsed


def equation(value: str | None) -> sp.Expr | sp.Equality | Relational:
    """Parse an equation or inequality string into a SymPy relation."""
    if not value:
        raise ValueError("Equation is required.")

    for operator in ("<=", ">=", "<", ">", "="):
        if operator in value:
            left, right = value.split(operator, 1)
            left_expr = expression(left)
            right_expr = expression(right)

            if operator == "<=":
                return sp.Le(left_expr, right_expr)
            if operator == ">=":
                return sp.Ge(left_expr, right_expr)
            if operator == "<":
                return sp.Lt(left_expr, right_expr)
            if operator == ">":
                return sp.Gt(left_expr, right_expr)

            return sp.Eq(left_expr, right_expr)

    return sp.Eq(expression(value), 0)


def matrix(rows: list[list[str]]) -> sp.Matrix:
    """Parse a matrix from expression strings."""
    if not rows:
        raise ValueError("Matrix is required.")

    return sp.Matrix([[expression(cell) for cell in row] for row in rows])


def vector(values: list[str]) -> sp.Matrix:
    """Parse a column vector from expression strings."""
    if not values:
        raise ValueError("Vector is required.")

    return sp.Matrix([expression(value) for value in values])


def point(value: PointInput) -> sp.Point2D:
    """Parse a two-dimensional point from expression strings."""
    return sp.Point2D(expression(value.x), expression(value.y))


def first_expression(request: MathRequest) -> sp.Expr:
    """Read and parse the primary expression from a request."""
    return expression(request.expression)
