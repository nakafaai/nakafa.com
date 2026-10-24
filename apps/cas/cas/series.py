"""Series, summation, and product CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, result, step
from cas.schema import (
    MAX_SUMMATION_TERMS,
    MAX_TRANSCENDENTAL_SERIES_ORDER,
    MathRequest,
    MathResult,
)

EQUALS = expression_text("equals", "=")
TRANSCENDENTAL_FUNCTIONS = (
    sp.sin,
    sp.cos,
    sp.tan,
    sp.asin,
    sp.acos,
    sp.atan,
    sp.exp,
    sp.log,
)


def expand(request: MathRequest) -> MathResult:
    """Expand a Taylor series around the requested point."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    point = parse.expression(request.point or "0")
    order = _series_order(request)
    _refuse_transcendental_order(expr, order)
    # SymPy's `n` parameter is the expansion cutoff, so degree `order` needs the
    # next cutoff to keep the requested Taylor polynomial degree.
    # https://docs.sympy.org/latest/modules/series/series.html
    sympy_order = order + 1
    offset = sp.Dummy("offset")
    shifted = expr.subs(variable, point + offset)
    output = shifted.series(offset, 0, sympy_order).subs(offset, variable - point)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="The requested series expansion was checked exactly.",
        steps=[step("series", primary=expr, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def _series_order(request: MathRequest) -> int:
    """Read the requested Taylor polynomial degree without truthy fallbacks."""
    if request.order is None:
        return 6

    if request.order < 0:
        raise ValueError("Series order must be non-negative.")

    return request.order


def _refuse_transcendental_order(expr: sp.Expr, order: int) -> None:
    """Refuse a high order for a transcendental input, which SymPy expands slowly."""
    if order > MAX_TRANSCENDENTAL_SERIES_ORDER and expr.has(*TRANSCENDENTAL_FUNCTIONS):
        raise ValueError(
            "Series order for a transcendental function may be at most "
            f"{MAX_TRANSCENDENTAL_SERIES_ORDER}."
        )


def _refuse_long_range(lower: sp.Expr, upper: sp.Expr) -> None:
    """Refuse an integer range with more terms than SymPy may sum or multiply."""
    if (
        lower.is_integer is True
        and upper.is_integer is True
        and upper - lower + 1 > MAX_SUMMATION_TERMS
    ):
        raise ValueError(
            f"A summation or product may have at most {MAX_SUMMATION_TERMS} terms."
        )


def summation(request: MathRequest) -> MathResult:
    """Compute an exact finite or symbolic summation."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    lower = parse.expression(request.lower)
    upper = parse.expression(request.upper)
    _refuse_long_range(lower, upper)
    output = sp.summation(expr, (variable, lower, upper))

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="The summation was checked exactly.",
        steps=[
            step(
                "summation",
                primary=sp.Sum(expr, (variable, lower, upper)),
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="partial",
    )


def product(request: MathRequest) -> MathResult:
    """Compute an exact finite or symbolic product."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    lower = parse.expression(request.lower)
    upper = parse.expression(request.upper)
    _refuse_long_range(lower, upper)
    output = sp.product(expr, (variable, lower, upper))

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="The product was checked exactly.",
        steps=[
            step(
                "product",
                primary=sp.Product(expr, (variable, lower, upper)),
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="partial",
    )
