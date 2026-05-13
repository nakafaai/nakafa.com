"""Algebraic CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")
IMPLIES = expression_text("becomes", "\\Rightarrow")


def evaluate(request: MathRequest) -> MathResult:
    """Evaluate exact arithmetic or symbolic expressions."""
    original = parse.expression(request.expression, evaluate=False)
    value = sp.simplify(parse.first_expression(request))
    _require_finite(value)
    steps = _evaluate_steps(original, value)

    return result(
        request,
        status="verified",
        primary=original,
        secondary=value,
        reason="Exact arithmetic was checked.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
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
    steps = _transform_steps(operation, expr, output)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason=f"The {operation} transformation was checked.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def domain(request: MathRequest) -> MathResult:
    """Derive denominator restrictions for a rational expression."""
    expr = parse.first_expression(request)
    variable = parse.symbol(request.variable)
    denominator = sp.denom(sp.together(expr))
    excluded = sp.solve(sp.Eq(denominator, 0), variable)

    conditions = [sp.Ne(variable, value) for value in excluded]

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
            reason="The difference simplified to zero.",
            conditions=_comparison_conditions(left, right),
            steps=[
                step(
                    "compare",
                    primary=left - right,
                    relation=EQUALS,
                    secondary=difference,
                ),
                step(
                    "compare",
                    primary=left,
                    relation=expression_text("same as", "\\equiv"),
                    secondary=right,
                ),
            ],
            stepStatus="complete",
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
                steps=[
                    step(
                        "compare",
                        primary=left,
                        relation=expression_text("not equal", "\\not="),
                        secondary=right,
                        items=[item("counterexample", scope)],
                    )
                ],
                stepStatus="partial",
            )

    return result(
        request,
        status="inconclusive",
        primary=left,
        secondary=right,
        reason="Equality was not proven and no counterexample was found.",
    )


def _comparison_conditions(left: sp.Expr, right: sp.Expr) -> list[object]:
    """Collect denominator restrictions from both compared expressions."""
    symbols = sorted(left.free_symbols | right.free_symbols, key=str)
    conditions: list[object] = []

    for expr in (left, right):
        denominator = sp.denom(sp.together(expr))
        for symbol in symbols:
            for excluded in sp.solve(sp.Eq(denominator, 0), symbol):
                conditions.append(sp.Ne(symbol, excluded))

    return sorted(set(conditions), key=str)


def _require_finite(value: sp.Expr) -> None:
    """Reject undefined arithmetic before it becomes verified evidence."""
    if value.is_finite is False:
        raise ValueError("Evaluation requires a finite value.")

    non_finite_values = (sp.oo, -sp.oo, sp.zoo, sp.nan)
    if value in non_finite_values:
        raise ValueError("Evaluation requires a finite value.")

    if any(value.has(non_finite_value) for non_finite_value in non_finite_values):
        raise ValueError("Evaluation requires a finite value.")


def _evaluate_steps(original: sp.Expr, value: sp.Expr) -> list:
    """Create simple arithmetic evidence without losing the user expression."""
    if original == value or str(original) == str(value):
        return []

    division_step = _numeric_division_step(original)
    if division_step is None:
        return [step("evaluate", primary=original, relation=EQUALS, secondary=value)]

    reduced, proof_step = division_step

    if reduced == value:
        return [proof_step]

    return [
        proof_step,
        step("evaluate", primary=reduced, relation=EQUALS, secondary=value),
    ]


def _numeric_division_step(expr: sp.Expr):
    """Reduce one visible numeric division inside an unevaluated product."""
    if not expr.is_Mul:
        return None

    args = [parse.expression(str(arg)) for arg in expr.args]
    reciprocal = next(
        (
            (index, arg)
            for index, arg in enumerate(args)
            if isinstance(arg, sp.Rational) and arg.p == 1 and arg.q != 1
        ),
        None,
    )

    if reciprocal is None:
        return None

    reciprocal_index, reciprocal_value = reciprocal
    numerator_index = next(
        (
            index
            for index, arg in reversed(list(enumerate(args)))
            if index != reciprocal_index and arg.is_number
        ),
        None,
    )

    if numerator_index is None:
        return None

    numerator = args[numerator_index]
    denominator = sp.Integer(reciprocal_value.q)
    quotient = sp.simplify(numerator / denominator)
    reduced_args = [
        quotient if index == numerator_index else arg
        for index, arg in enumerate(args)
        if index != reciprocal_index
    ]
    reduced = sp.Mul(*reduced_args, evaluate=False)

    return (
        reduced,
        step(
            "divide",
            primary=expression_text(
                f"{numerator}/{denominator}",
                f"\\frac{{{sp.latex(numerator)}}}{{{sp.latex(denominator)}}}",
            ),
            relation=EQUALS,
            secondary=quotient,
        ),
    )


def _transform_steps(operation: str, expr: sp.Expr, output: sp.Expr) -> list:
    """Create deterministic algebra transform evidence when it is available."""
    if expr == output:
        return []

    if operation in {"cancel", "simplify"}:
        factored = _factored_rational(expr)

        if factored != expr and output != factored:
            return [
                step("factor", primary=expr, relation=EQUALS, secondary=factored),
                step("cancel", primary=factored, relation=EQUALS, secondary=output),
            ]

    return [step(operation, primary=expr, relation=IMPLIES, secondary=output)]


def _factored_rational(expr: sp.Expr) -> sp.Expr:
    """Factor the numerator and denominator without cancelling them."""
    combined = parse.expression(str(sp.together(expr)))
    numerator, denominator = combined.as_numer_denom()
    factored_numerator = sp.factor(numerator)
    factored_denominator = sp.factor(denominator)

    if factored_denominator == 1:
        return sp.factor(expr)

    return sp.Mul(
        factored_numerator,
        sp.Pow(factored_denominator, -1, evaluate=False),
        evaluate=False,
    )


def _sample_scopes(symbols: list[sp.Symbol]) -> list[dict[sp.Symbol, int]]:
    """Create deterministic numeric scopes for counterexample checks."""
    if not symbols:
        return [{}]

    samples = [-3, -2, -1, 0, 1, 2, 3]

    return [
        {symbol: sample + index for index, symbol in enumerate(symbols)}
        for sample in samples
    ]
