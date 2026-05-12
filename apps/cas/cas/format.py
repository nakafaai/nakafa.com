"""Shared result formatting for CAS responses."""

from collections.abc import Sequence

import sympy as sp

from cas.schema import (
    MathExpression,
    MathItem,
    MathRequest,
    MathResult,
    MathStatus,
    MathStep,
    MathStepStatus,
)


def expression(value: object) -> MathExpression:
    """Render a CAS value as plain text and LaTeX."""
    return MathExpression(expression=str(value), latex=sp.latex(value))


def expression_text(value: str, latex: str | None = None) -> MathExpression:
    """Render expression text that is already display-safe."""
    return MathExpression(expression=value, latex=latex or value)


def math_expression(value: object) -> MathExpression:
    """Keep display-safe expressions intact and render all other CAS values."""
    if isinstance(value, MathExpression):
        return value

    return expression(value)


def item(label: str, value: object) -> MathItem:
    """Render a labeled supporting CAS value."""
    rendered = math_expression(value)

    return MathItem(label=label, value=rendered.expression, latex=rendered.latex)


def step(
    action: str,
    *,
    primary: object,
    relation: MathExpression | None = None,
    secondary: object | None = None,
    items: Sequence[MathItem] | None = None,
) -> MathStep:
    """Build one deterministic math evidence step."""
    return MathStep(
        action=action,
        primary=math_expression(primary),
        relation=relation,
        secondary=math_expression(secondary) if secondary is not None else None,
        items=list(items or []),
    )


def result(
    request: MathRequest,
    *,
    status: MathStatus,
    primary: object,
    reason: str,
    secondary: object | None = None,
    items: Sequence[MathItem] | None = None,
    conditions: Sequence[object] | None = None,
    steps: Sequence[MathStep] | None = None,
    stepStatus: MathStepStatus = "unavailable",
) -> MathResult:
    """Build the stable result envelope shared with the TypeScript client."""
    return MathResult(
        kind=request.operation,
        operation=request.operation,
        status=status,
        input=request,
        primary=math_expression(primary),
        secondary=math_expression(secondary) if secondary is not None else None,
        items=list(items or []),
        conditions=[
            condition
            if isinstance(condition, MathExpression)
            else expression(condition)
            for condition in conditions or []
        ],
        steps=list(steps or []),
        stepStatus=stepStatus,
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
