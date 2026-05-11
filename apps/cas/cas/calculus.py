"""Calculus CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, result, step
from cas.schema import MathRequest, MathResult, MathStep

EQUALS = expression_text("equals", "=")


def differentiate(request: MathRequest) -> MathResult:
    """Differentiate an expression with respect to one variable."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    output = sp.diff(expr, variable)
    steps = _differentiate_steps(expr, variable, output)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="SymPy computed the derivative.",
        steps=steps,
        stepStatus="complete" if steps else "partial",
    )


def integrate(request: MathRequest) -> MathResult:
    """Integrate an expression, using bounds when both are provided."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)

    if request.lower is not None and request.upper is not None:
        lower = parse.expression(request.lower)
        upper = parse.expression(request.upper)
        output = sp.integrate(
            expr,
            (variable, lower, upper),
        )
        primary = sp.Integral(expr, (variable, lower, upper))
    else:
        output = sp.integrate(expr, variable)
        primary = sp.Integral(expr, variable)

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="SymPy computed the integral.",
        steps=[step("integrate", primary=primary, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def limit(request: MathRequest) -> MathResult:
    """Compute a one-variable limit at the requested point."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    point = parse.expression(request.point)
    output = sp.limit(expr, variable, point)

    primary = sp.Limit(expr, variable, point)

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="SymPy computed the limit.",
        steps=[step("limit", primary=primary, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def _differentiate_steps(
    expr: sp.Expr, variable: sp.Symbol, output: sp.Expr
) -> list[MathStep]:
    """Derive readable term-by-term steps for polynomial derivatives."""
    try:
        sp.Poly(expr, variable)
    except sp.PolynomialError:
        return [step("differentiate", primary=expr, relation=EQUALS, secondary=output)]

    steps = [
        step(
            "differentiate-term",
            primary=sp.Derivative(term, variable, evaluate=False),
            relation=EQUALS,
            secondary=sp.diff(term, variable),
        )
        for term in sp.expand(expr).as_ordered_terms()
        if sp.diff(term, variable) != 0
    ]
    steps.append(
        step(
            "differentiate",
            primary=sp.Derivative(expr, variable, evaluate=False),
            relation=EQUALS,
            secondary=output,
        )
    )

    return steps
