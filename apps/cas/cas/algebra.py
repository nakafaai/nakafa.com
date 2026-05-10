"""Algebraic CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import item, result
from cas.schema import MathRequest, MathResult


def evaluate(request: MathRequest) -> MathResult:
    """Evaluate exact arithmetic or symbolic expressions."""
    value = sp.simplify(parse.first_expression(request))

    return result(
        request,
        status="verified",
        primary=parse.first_expression(request),
        secondary=value,
        reason="Exact arithmetic was evaluated by SymPy.",
    )


def transform(request: MathRequest) -> MathResult:
    """Apply one algebraic transformation selected by the request operation."""
    expr = parse.first_expression(request)
    operation = request.operation
    output = {
        "apart": lambda: sp.apart(expr),
        "cancel": lambda: sp.cancel(expr),
        "expand": lambda: sp.expand(expr),
        "factor": lambda: sp.factor(expr),
        "rationalize": lambda: sp.radsimp(expr),
        "simplify": lambda: sp.simplify(expr),
        "together": lambda: sp.together(expr),
    }[operation]()

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason=f"SymPy applied {operation} to the expression.",
    )


def domain(request: MathRequest) -> MathResult:
    """Derive denominator restrictions for a rational expression."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    denominator = sp.denom(sp.together(expr))
    excluded = sp.solve(sp.Eq(denominator, 0), variable)

    conditions = [sp.latex(sp.Ne(variable, value)) for value in excluded]

    return result(
        request,
        status="verified",
        primary=expr,
        reason="Denominator restrictions were derived from the expression.",
        items=[item("domain", f"{variable} in Reals")],
        conditions=conditions,
    )


def compare(request: MathRequest) -> MathResult:
    """Compare two expressions with proof and counterexample checks."""
    left = parse.expression(request.left)
    right = parse.expression(request.right)
    difference = sp.simplify(left - right)

    if difference == 0:
        return result(
            request,
            status="verified",
            primary=left,
            secondary=right,
            reason="SymPy simplified the difference to zero.",
            conditions=_comparison_conditions(left, right),
        )

    symbols = [
        symbol
        for symbol in sorted(left.free_symbols | right.free_symbols, key=str)
        if isinstance(symbol, sp.Symbol)
    ]

    for scope in _sample_scopes(symbols):
        left_value = left.subs(list(scope.items()))
        right_value = right.subs(list(scope.items()))

        if left_value.is_finite is False or right_value.is_finite is False:
            continue

        if sp.N(left_value) != sp.N(right_value):
            return result(
                request,
                status="contradicted",
                primary=left,
                secondary=right,
                reason="A deterministic numeric counterexample was found.",
                items=[item("counterexample", scope)],
            )

    return result(
        request,
        status="inconclusive",
        primary=left,
        secondary=right,
        reason="SymPy did not prove equality or find a counterexample.",
    )


def _comparison_conditions(left: sp.Expr, right: sp.Expr) -> list[str]:
    """Collect denominator restrictions from both compared expressions."""
    symbols = sorted(left.free_symbols | right.free_symbols, key=str)
    conditions: list[str] = []

    for expr in (left, right):
        denominator = sp.denom(sp.together(expr))
        for symbol in symbols:
            for excluded in sp.solve(sp.Eq(denominator, 0), symbol):
                conditions.append(sp.latex(sp.Ne(symbol, excluded)))

    return sorted(set(conditions))


def _sample_scopes(symbols: list[sp.Symbol]) -> list[dict[sp.Symbol, int]]:
    """Create deterministic numeric scopes for counterexample checks."""
    if not symbols:
        return [{}]

    samples = [-3, -2, -1, 0, 1, 2, 3]

    return [
        {symbol: sample + index for index, symbol in enumerate(symbols)}
        for sample in samples
    ]
