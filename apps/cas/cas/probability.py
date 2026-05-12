"""Probability CAS operations backed by SymPy."""

import sympy as sp
from sympy.stats import Bernoulli, Binomial, E, Normal, Poisson, Uniform, variance

from cas import parse
from cas.format import result
from cas.schema import MathRequest, MathResult


def run(request: MathRequest) -> MathResult:
    """Run distribution, expectation, and variance operations."""
    variable = parse.symbol(request.variable)
    distribution = _distribution(request, variable)

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


def _distribution(request: MathRequest, variable: sp.Symbol) -> object:
    """Build a supported SymPy probability distribution."""
    name = request.distribution or ""
    parameters = request.parameters

    if name == "bernoulli":
        return Bernoulli(str(variable), parse.expression(parameters.get("p", "1/2")))
    if name == "binomial":
        return Binomial(
            str(variable),
            parse.expression(parameters.get("n", "1")),
            parse.expression(parameters.get("p", "1/2")),
        )
    if name == "normal":
        standard_deviation = parameters.get(
            "standard_deviation", parameters.get("standardDeviation", "1")
        )

        return Normal(
            str(variable),
            parse.expression(parameters.get("mean", "0")),
            parse.expression(standard_deviation),
        )
    if name == "poisson":
        return Poisson(str(variable), parse.expression(parameters.get("lambda", "1")))
    if name == "uniform":
        return Uniform(
            str(variable),
            parse.expression(parameters.get("lower", "0")),
            parse.expression(parameters.get("upper", "1")),
        )

    raise ValueError(f"Unsupported distribution: {name}")
