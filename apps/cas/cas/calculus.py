"""Calculus CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import result
from cas.schema import MathRequest, MathResult


def differentiate(request: MathRequest) -> MathResult:
    """Differentiate an expression with respect to one variable."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    output = sp.diff(expr, variable)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the derivative.",
    )


def integrate(request: MathRequest) -> MathResult:
    """Integrate an expression, using bounds when both are provided."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)

    if request.lower is not None and request.upper is not None:
        output = sp.integrate(
            expr,
            (
                variable,
                parse.expression(request.lower),
                parse.expression(request.upper),
            ),
        )
    else:
        output = sp.integrate(expr, variable)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the integral.",
    )


def limit(request: MathRequest) -> MathResult:
    """Compute a one-variable limit at the requested point."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    point = parse.expression(request.point)
    output = sp.limit(expr, variable, point)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the limit.",
    )
