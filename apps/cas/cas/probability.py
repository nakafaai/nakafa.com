"""Probability CAS operations backed by SymPy."""

import sympy as sp
from sympy.stats import Bernoulli, Binomial, E, Normal, P, Poisson, Uniform, variance

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run distribution, expectation, and variance operations."""
    variable = parse.symbol(request.variable)
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
        output = E(distribution)
    elif request.operation == "variance_probability":
        output = variance(distribution)
    elif request.operation == "distribution":
        output = distribution
    else:
        raise ValueError(f"Unsupported probability operation: {request.operation}")

    return result(
        request,
        status="verified",
        primary=distribution,
        secondary=output,
        reason="The probability distribution was checked exactly.",
    )


def _cumulative_probability(
    request: MathRequest, distribution: object, variable: sp.Symbol
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
    request: MathRequest, distribution: object, variable: sp.Symbol
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
    request: MathRequest, distribution: object, variable: sp.Symbol
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
    request: MathRequest, distribution: object, variable: sp.Symbol
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


def _lower_event(distribution: object, lower: sp.Expr, inclusive: bool):
    """Build a lower-bound probability event."""
    if inclusive:
        return distribution >= lower

    return distribution > lower


def _upper_event(distribution: object, upper: sp.Expr, inclusive: bool):
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


def _distribution(request: MathRequest, variable: sp.Symbol) -> object:
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
        standard_deviation = _aliased_parameter(
            name,
            parameters,
            "standard_deviation",
            "standardDeviation",
        )

        return Normal(
            str(variable),
            parse.expression(_parameter(name, parameters, "mean")),
            parse.expression(standard_deviation),
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


def _aliased_parameter(
    distribution: str, parameters: dict[str, str], first: str, second: str
) -> str:
    """Return a required distribution parameter that accepts one alias."""
    value = parameters.get(first) or parameters.get(second)

    if value:
        return value

    raise ValueError(f"{distribution} distribution requires parameter: {first}")
