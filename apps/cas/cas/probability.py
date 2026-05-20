"""Probability CAS operations backed by SymPy."""

import sympy as sp
from sympy.stats import Bernoulli, Binomial, E, Normal, P, Poisson, Uniform, variance

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run distribution, expectation, and variance operations."""
    variable = _distribution_variable(request)
    distribution = _distribution(request, variable)

    if request.operation == "cumulative_probability":
        return _cumulative_probability(request, distribution, variable)
    if request.operation == "interval_probability":
        return _interval_probability(request, distribution, variable)
    if request.operation == "point_probability":
        return _point_probability(request, distribution, variable)
    if request.operation == "tail_probability":
        return _tail_probability(request, distribution, variable)
    if request.operation == "expected_value":
        target = _summary_target(request, variable)
        # SymPy Stats models random variables and queries through E, variance,
        # and P, so transformed moments substitute the selected distribution.
        # https://docs.sympy.org/latest/modules/stats.html
        output = E(_replace_random_variable(target, variable, distribution))
        primary = expression_text(
            f"E({target})",
            f"E\\left[{sp.latex(target)}\\right]",
        )
        reason = "The expected value was checked exactly from the distribution."
    elif request.operation == "variance_probability":
        target = _summary_target(request, variable)
        # Keep variance on the transformed random expression, matching the
        # SymPy Stats `variance(expression)` API.
        # https://docs.sympy.org/latest/modules/stats.html
        output = variance(_replace_random_variable(target, variable, distribution))
        primary = expression_text(
            f"Var({target})",
            f"\\operatorname{{Var}}\\left({sp.latex(target)}\\right)",
        )
        reason = "The variance was checked exactly from the distribution."
    elif request.operation == "distribution":
        return result(
            request,
            status="verified",
            primary=distribution,
            secondary=distribution,
            reason="The probability distribution was checked exactly.",
        )
    else:
        raise ValueError(f"Unsupported probability operation: {request.operation}")

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason=reason,
        steps=[
            step(
                request.operation.replace("_", "-"),
                primary=primary,
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="partial",
    )


def _distribution_variable(request: MathRequest) -> sp.Symbol:
    """Return the random variable symbol used by the named distribution."""
    if request.variable:
        parsed = parse.expression(request.variable)

        if isinstance(parsed, sp.Symbol):
            return parsed

        if request.operation in {"expected_value", "variance_probability"}:
            return _single_random_symbol(parsed)

        raise ValueError("Probability variable must be one symbol.")

    if request.expression:
        return _single_random_symbol(parse.expression(request.expression))

    return sp.Symbol("X")


def _summary_target(request: MathRequest, variable: sp.Symbol) -> sp.Expr:
    """Return the expression whose expectation or variance should be checked."""
    if request.expression:
        target = parse.expression(request.expression)
        _require_selected_random_variable(target, variable)
        return target

    if request.variable:
        target = parse.expression(request.variable)
        _require_selected_random_variable(target, variable)
        return target

    return variable


def _require_selected_random_variable(target: sp.Expr, variable: sp.Symbol) -> None:
    """Reject moment targets that are not computed from the selected variable."""
    if target.free_symbols == {variable}:
        return

    raise ValueError(
        "Probability moment expression must use only the selected random variable."
    )


def _single_random_symbol(expression: sp.Expr) -> sp.Symbol:
    """Infer the random variable when a moment target contains one symbol."""
    symbols = [
        symbol for symbol in expression.free_symbols if isinstance(symbol, sp.Symbol)
    ]

    if len(symbols) == 1 and len(symbols) == len(expression.free_symbols):
        return symbols[0]

    raise ValueError("Probability expression must contain one random variable.")


def _replace_random_variable(
    target: sp.Expr, variable: sp.Symbol, distribution: sp.Basic
) -> sp.Basic:
    """Substitute the named random variable into a transformed moment target."""
    return sp.sympify(target.subs(variable, distribution))


def _cumulative_probability(
    request: MathRequest, distribution: sp.Basic, variable: sp.Symbol
) -> MathResult:
    """Compute the probability that a random variable is below an upper bound."""
    upper = parse.expression(request.upper)
    inclusive = _inclusive(request.inclusive)
    output = P(_upper_event(distribution, upper, inclusive))
    relation = _upper_relation(inclusive)
    primary = expression_text(
        f"P({variable} {relation[0]} {upper})",
        f"P\\left({sp.latex(variable)} {relation[1]} {sp.latex(upper)}\\right)",
    )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The cumulative probability was checked from the distribution.",
        items=[item("approximation", sp.N(output))],
        steps=[
            step(
                "cumulative-probability",
                primary=primary,
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="complete",
    )


def _interval_probability(
    request: MathRequest, distribution: sp.Basic, variable: sp.Symbol
) -> MathResult:
    """Compute the probability that a random variable falls between two bounds."""
    lower = parse.expression(request.lower)
    upper = parse.expression(request.upper)
    lower_inclusive = _inclusive(request.lowerInclusive)
    upper_inclusive = _inclusive(request.upperInclusive)
    output = P(
        _lower_event(distribution, lower, lower_inclusive)
        & _upper_event(distribution, upper, upper_inclusive)
    )
    lower_relation = _interval_lower_relation(lower_inclusive)
    upper_relation = _upper_relation(upper_inclusive)
    latex_probability = (
        f"P\\left({sp.latex(lower)} {lower_relation[1]} "
        f"{sp.latex(variable)} {upper_relation[1]} {sp.latex(upper)}\\right)"
    )
    primary = expression_text(
        f"P({lower} {lower_relation[0]} {variable} {upper_relation[0]} {upper})",
        latex_probability,
    )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The interval probability was checked from the distribution.",
        items=[item("approximation", sp.N(output))],
        steps=[
            step(
                "interval-probability",
                primary=primary,
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="complete",
    )


def _point_probability(
    request: MathRequest, distribution: sp.Basic, variable: sp.Symbol
) -> MathResult:
    """Compute the probability that a random variable equals one value."""
    point = parse.expression(request.point)
    output = P(sp.Eq(distribution, point))
    primary = expression_text(
        f"P({variable} = {point})",
        f"P\\left({sp.latex(variable)} = {sp.latex(point)}\\right)",
    )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The point probability was checked from the distribution.",
        items=[item("approximation", sp.N(output))],
        steps=[
            step(
                "point-probability",
                primary=primary,
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="complete",
    )


def _tail_probability(
    request: MathRequest, distribution: sp.Basic, variable: sp.Symbol
) -> MathResult:
    """Compute the probability that a random variable is above a lower bound."""
    lower = parse.expression(request.lower)
    inclusive = _inclusive(request.inclusive)
    output = P(_lower_event(distribution, lower, inclusive))
    relation = _lower_relation(inclusive)
    primary = expression_text(
        f"P({variable} {relation[0]} {lower})",
        f"P\\left({sp.latex(variable)} {relation[1]} {sp.latex(lower)}\\right)",
    )

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The tail probability was checked from the distribution.",
        items=[item("approximation", sp.N(output))],
        steps=[
            step(
                "tail-probability",
                primary=primary,
                relation=EQUALS,
                secondary=output,
            )
        ],
        stepStatus="complete",
    )


def _inclusive(value: bool | None) -> bool:
    """Default omitted probability bounds to inclusive endpoints."""
    return True if value is None else value


def _lower_event(distribution: sp.Basic, lower: sp.Expr, inclusive: bool):
    """Build a lower-bound probability event."""
    if inclusive:
        return distribution >= lower

    return distribution > lower


def _upper_event(distribution: sp.Basic, upper: sp.Expr, inclusive: bool):
    """Build an upper-bound probability event."""
    if inclusive:
        return distribution <= upper

    return distribution < upper


def _lower_relation(inclusive: bool) -> tuple[str, str]:
    """Render lower-bound relation text and LaTeX."""
    if inclusive:
        return ">=", "\\ge"

    return ">", ">"


def _interval_lower_relation(inclusive: bool) -> tuple[str, str]:
    """Render the lower relation when the bound is printed before the variable."""
    if inclusive:
        return "<=", "\\le"

    return "<", "<"


def _upper_relation(inclusive: bool) -> tuple[str, str]:
    """Render upper-bound relation text and LaTeX."""
    if inclusive:
        return "<=", "\\le"

    return "<", "<"


def _distribution(request: MathRequest, variable: sp.Symbol) -> sp.Basic:
    """Build a supported SymPy probability distribution."""
    name = request.distribution or ""
    parameters = request.parameters

    if name == "bernoulli":
        probability = parse.expression(_parameter(name, parameters, "p"))
        return Bernoulli(str(variable), probability)
    if name == "binomial":
        return Binomial(
            str(variable),
            parse.expression(_parameter(name, parameters, "n")),
            parse.expression(_parameter(name, parameters, "p")),
        )
    if name == "normal":
        return Normal(
            str(variable),
            parse.expression(_parameter(name, parameters, "mean")),
            parse.expression(_parameter(name, parameters, "standard_deviation")),
        )
    if name == "poisson":
        return Poisson(
            str(variable), parse.expression(_parameter(name, parameters, "lambda"))
        )
    if name == "uniform":
        return Uniform(
            str(variable),
            parse.expression(_parameter(name, parameters, "lower")),
            parse.expression(_parameter(name, parameters, "upper")),
        )

    raise ValueError(f"Unsupported distribution: {name}")


def _parameter(distribution: str, parameters: dict[str, str], name: str) -> str:
    """Return a required distribution parameter."""
    value = parameters.get(name)

    if value:
        return value

    raise ValueError(f"{distribution} distribution requires parameter: {name}")
