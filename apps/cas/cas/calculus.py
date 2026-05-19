"""Calculus CAS operations backed by SymPy."""

from collections.abc import Iterable
from typing import cast

import sympy as sp
from sympy.calculus.util import continuous_domain

from cas import parse
from cas.format import expression_text, inconclusive, result, step
from cas.schema import MathRequest, MathResult, MathStep

EQUALS = expression_text("equals", "=")


def differentiate(request: MathRequest) -> MathResult:
    """Differentiate an expression with respect to one variable."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    order = _derivative_order(request)
    output = sp.diff(expr, variable, order)
    steps = _differentiate_steps(expr, variable, output, order)

    return result(
        request,
        status="verified",
        primary=expr,
        secondary=output,
        reason="The derivative was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "partial",
    )


def integrate(request: MathRequest) -> MathResult:
    """Integrate an expression, using bounds when both are provided."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    has_lower = request.lower is not None
    has_upper = request.upper is not None

    if has_lower != has_upper:
        raise ValueError("Definite integrals require both lower and upper bounds.")

    if has_lower and has_upper:
        lower = parse.expression(request.lower)
        upper = parse.expression(request.upper)
        primary = sp.Integral(expr, (variable, lower, upper))
        fallback = _definite_integral_fallback(
            request,
            expr,
            variable,
            lower,
            upper,
            primary,
        )
        if fallback:
            return fallback

        output = sp.integrate(expr, (variable, lower, upper))
    else:
        output = sp.integrate(expr, variable)
        primary = sp.Integral(expr, variable)

    if _has_unevaluated_integral(output) or _is_nonfinite_integral_value(output):
        return result(
            request,
            status="inconclusive",
            primary=primary,
            reason="The integral could not be determined exactly.",
        )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The integral was checked exactly.",
        steps=[step("integrate", primary=primary, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def _definite_integral_fallback(
    request: MathRequest,
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
    primary: sp.Integral,
) -> MathResult | None:
    """Try exact definite-integral identities before generic integration."""
    reflected = _reflection_integral_value(expr, variable, lower, upper)
    if reflected is not None:
        return _integral_result(request, primary, reflected, "integrate-symmetry")

    if expr.free_symbols - {variable}:
        termwise = _termwise_definite_integral_value(expr, variable, lower, upper)
        if termwise is not None:
            return _integral_result(
                request,
                primary,
                termwise,
                "integrate-sum",
                "The definite integral was checked term by term.",
            )

    return _arctangent_reflection_integral(
        request,
        expr,
        variable,
        lower,
        upper,
        primary,
    )


def _arctangent_reflection_integral(
    request: MathRequest,
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
    primary: sp.Integral,
) -> MathResult | None:
    """Try x = tan(theta), then use interval-reflection symmetry."""
    reflected = _arctangent_reflection_value(expr, variable, lower, upper)
    if reflected is None:
        return None

    theta = _fresh_symbol("theta", expr.free_symbols | {variable})
    substitution = sp.tan(theta)
    differential = sp.diff(substitution, theta)
    transformed = cast(
        sp.Expr,
        sp.trigsimp(sp.simplify(expr.subs(variable, substitution) * differential)),
    )
    transformed_lower = sp.atan(lower)
    transformed_upper = sp.atan(upper)
    transformed_primary = sp.Integral(
        transformed,
        (theta, transformed_lower, transformed_upper),
    )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=reflected,
        reason="The definite integral was checked by substitution and symmetry.",
        steps=[
            step(
                "substitute",
                primary=primary,
                relation=EQUALS,
                secondary=transformed_primary,
            ),
            step(
                "integrate-symmetry",
                primary=transformed_primary,
                relation=EQUALS,
                secondary=reflected,
            ),
        ],
        stepStatus="partial",
    )


def _integral_result(
    request: MathRequest,
    primary: sp.Integral,
    output: sp.Expr,
    action: str,
    reason: str = "The definite integral was checked by symmetry.",
) -> MathResult:
    """Build a verified definite-integral result from an exact identity."""
    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason=reason,
        steps=[step(action, primary=primary, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def _termwise_definite_integral_value(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
) -> sp.Expr | None:
    """Evaluate a sum only when every term is checked exactly."""
    if not isinstance(expr, sp.Add):
        return None

    terms = [cast(sp.Expr, term) for term in expr.as_ordered_terms()]
    values = [
        _definite_integral_term_value(term, variable, lower, upper) for term in terms
    ]

    total = sp.S.Zero
    for value in values:
        if value is None:
            return None

        total += value

    return sp.simplify(total)


def _definite_integral_term_value(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
) -> sp.Expr | None:
    """Evaluate one definite-integral term without certifying weak evidence."""
    if variable not in expr.free_symbols:
        return sp.simplify(expr * (upper - lower))

    reflected = _reflection_integral_value(expr, variable, lower, upper)
    if reflected is not None:
        return reflected

    arctangent_reflected = _arctangent_reflection_value(expr, variable, lower, upper)
    if arctangent_reflected is not None:
        return arctangent_reflected

    output = sp.integrate(expr, (variable, lower, upper))
    if _has_unevaluated_integral(output) or _is_nonfinite_integral_value(output):
        return None

    return cast(sp.Expr, output)


def _arctangent_reflection_value(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
) -> sp.Expr | None:
    """Return an arctangent-substitution symmetry value when exact."""
    theta = _fresh_symbol("theta", expr.free_symbols | {variable})
    substitution = sp.tan(theta)
    differential = sp.diff(substitution, theta)
    transformed = cast(
        sp.Expr,
        sp.trigsimp(sp.simplify(expr.subs(variable, substitution) * differential)),
    )
    transformed_lower = sp.atan(lower)
    transformed_upper = sp.atan(upper)

    return _reflection_integral_value(
        transformed,
        theta,
        transformed_lower,
        transformed_upper,
    )


def _reflection_integral_value(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
) -> sp.Expr | None:
    """Evaluate an integral when f(x) + f(a + b - x) is constant."""
    if not _is_continuous_on_closed_interval(expr, variable, lower, upper):
        return None

    reflected = expr.subs(variable, lower + upper - variable)
    pair = _constant_reflection_pair(expr + reflected, variable)

    if pair is None:
        return None

    return sp.simplify(pair * (upper - lower) / 2)


def _is_continuous_on_closed_interval(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr,
    upper: sp.Expr,
) -> bool:
    """Return whether the real integrand is proven continuous on the interval."""
    interval = _closed_interval(lower, upper)
    if interval is None:
        return False

    try:
        # `continuous_domain` proves the shortcut is not crossing a singularity.
        # https://docs.sympy.org/latest/modules/calculus/index.html
        domain = continuous_domain(expr, variable, interval)
    except NotImplementedError:
        return False

    return interval.is_subset(domain) is True


def _closed_interval(lower: sp.Expr, upper: sp.Expr) -> sp.Interval | None:
    """Build the closed interval covered by the definite integral bounds."""
    if sp.simplify(upper - lower).is_nonnegative is True:
        interval = sp.Interval(lower, upper)
        return interval if isinstance(interval, sp.Interval) else None

    if sp.simplify(lower - upper).is_nonnegative is True:
        interval = sp.Interval(upper, lower)
        return interval if isinstance(interval, sp.Interval) else None

    return None


def _constant_reflection_pair(value: sp.Expr, variable: sp.Symbol) -> sp.Expr | None:
    """Simplify a reflected integrand pair to a constant when possible."""
    simplified = sp.trigsimp(sp.simplify(value))
    if isinstance(simplified, sp.Expr) and variable not in simplified.free_symbols:
        return simplified

    if not value.has(sp.log):
        return None

    combined = sp.logcombine(value, force=True)
    if combined.func != sp.log:
        return None

    argument = sp.simplify(sp.trigsimp(sp.expand_trig(combined.args[0])))
    if variable in argument.free_symbols or argument.is_positive is not True:
        return None

    return cast(sp.Expr, sp.log(argument))


def _fresh_symbol(name: str, used: Iterable[object]) -> sp.Symbol:
    """Create a readable temporary symbol that does not shadow user variables."""
    candidate = sp.Symbol(name)
    if candidate not in used:
        return candidate

    suffix = 1
    while True:
        candidate = sp.Symbol(f"{name}_{suffix}")
        if candidate not in used:
            return candidate

        suffix += 1


def _has_unevaluated_integral(value: object) -> bool:
    """Return whether integration produced an unevaluated Integral expression."""
    return isinstance(value, sp.Integral) or (
        isinstance(value, sp.Basic) and value.has(sp.Integral)
    )


def _is_nonfinite_integral_value(value: object) -> bool:
    """Return whether a definite integral produced a non-finite value."""
    return isinstance(value, sp.Basic) and (
        value.has(sp.nan, sp.zoo) or value.is_finite is False
    )


def limit(request: MathRequest) -> MathResult:
    """Compute an ordinary two-sided limit at the requested point."""
    expr = parse.first_expression(request)
    variable = parse.symbol_from_expression(request.variable, request.expression)
    point = parse.expression(request.point)

    try:
        left = sp.limit(expr, variable, point, dir="-")
        right = sp.limit(expr, variable, point, dir="+")
        limits_differ = left != right and sp.simplify(left - right) != 0
    except NotImplementedError:
        return inconclusive(
            request,
            "The two-sided limit could not be determined exactly.",
        )

    if limits_differ:
        raise ValueError("Two-sided limit does not exist at the requested point.")

    output = right
    primary = sp.Limit(expr, variable, point, dir="+-")

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The limit was checked exactly.",
        steps=[step("limit", primary=primary, relation=EQUALS, secondary=output)],
        stepStatus="partial",
    )


def _derivative_order(request: MathRequest) -> int:
    """Read the requested derivative order."""
    if request.order is None:
        return 1

    if request.order < 1:
        raise ValueError("Derivative order must be positive.")

    return request.order


def _differentiate_steps(
    expr: sp.Expr, variable: sp.Symbol, output: sp.Expr, order: int
) -> list[MathStep]:
    """Derive readable term-by-term steps for polynomial derivatives."""
    if order != 1:
        return [
            step(
                "differentiate",
                primary=sp.Derivative(expr, (variable, order), evaluate=False),
                relation=EQUALS,
                secondary=output,
            )
        ]

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
