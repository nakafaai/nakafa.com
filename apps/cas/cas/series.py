"""Series, summation, and product CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import result
from cas.schema import MathRequest, MathResult


def expand(request: MathRequest) -> MathResult:
    """Expand a Taylor series around the requested point."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    point = int(parse.expression(request.point or "0"))
    order = request.order or 6
    output = sp.series(expr, variable, point, order)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the requested series expansion.",
    )


def summation(request: MathRequest) -> MathResult:
    """Compute an exact finite or symbolic summation."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    lower = parse.expression(request.lower)
    upper = parse.expression(request.upper)
    output = sp.summation(expr, (variable, lower, upper))

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the summation.",
    )


def product(request: MathRequest) -> MathResult:
    """Compute an exact finite or symbolic product."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    lower = parse.expression(request.lower)
    upper = parse.expression(request.upper)
    output = sp.product(expr, (variable, lower, upper))

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the product.",
    )
