"""Shared result formatting for CAS responses."""

import sympy as sp

from cas.schema import MathExpression, MathItem, MathRequest, MathResult, MathStatus


def expression(value: object) -> MathExpression:
    """Render a CAS value as plain text and LaTeX."""
    return MathExpression(expression=str(value), latex=sp.latex(value))


def item(label: str, value: object) -> MathItem:
    """Render a labeled supporting CAS value."""
    return MathItem(label=label, value=str(value), latex=sp.latex(value))


def result(
    request: MathRequest,
    *,
    status: MathStatus,
    primary: object,
    reason: str,
    secondary: object | None = None,
    items: list[MathItem] | None = None,
    conditions: list[str] | None = None,
) -> MathResult:
    """Build the stable result envelope shared with the TypeScript client."""
    return MathResult(
        kind=request.operation,
        operation=request.operation,
        status=status,
        input=request,
        primary=expression(primary),
        secondary=expression(secondary) if secondary is not None else None,
        items=items or [],
        conditions=conditions or [],
        reason=reason,
    )


def inconclusive(request: MathRequest, reason: str) -> MathResult:
    """Build an honest inconclusive result for unsupported operations."""
    return result(
        request,
        status="inconclusive",
        primary=request.expression or request.left or request.operation,
        reason=reason,
    )
