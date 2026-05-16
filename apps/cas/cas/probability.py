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
    if request.operation == "point_probability":
        return _point_probability(request, distribution, variable)
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
    """Compute the probability that a random variable is at most the upper bound."""
    upper = parse.expression(request.upper)
    output = P(distribution <= upper)
    primary = expression_text(
        f"P({variable} <= {upper})",
        f"P\\left({sp.latex(variable)} \\le {sp.latex(upper)}\\right)",
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
