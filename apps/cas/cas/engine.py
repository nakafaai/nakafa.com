"""Operation router for the fixed Nakafa CAS capability set."""

from cas import (
    algebra,
    calculus,
    discrete,
    equation,
    geometry,
    matrix,
    probability,
    stat,
)
from cas import series as series_engine
from cas.format import inconclusive
from cas.schema import MathRequest, MathResult

ALGEBRA = {
    "apart": algebra.transform,
    "cancel": algebra.transform,
    "compare": algebra.compare,
    "domain": algebra.domain,
    "evaluate": algebra.evaluate,
    "expand": algebra.transform,
    "factor": algebra.transform,
    "rationalize": algebra.transform,
    "simplify": algebra.transform,
    "together": algebra.transform,
}

EQUATION = {
    "roots": equation.roots,
    "solve": equation.solve,
}

CALCULUS = {
    "differentiate": calculus.differentiate,
    "integrate": calculus.integrate,
    "limit": calculus.limit,
}

SERIES = {
    "product": series_engine.product,
    "series": series_engine.expand,
    "summation": series_engine.summation,
}

GROUPS = {
    **ALGEBRA,
    **EQUATION,
    **CALCULUS,
    **SERIES,
    **dict.fromkeys(
        [
            "determinant",
            "eigenvalues",
            "eigenvectors",
            "inverse",
            "linear_system",
            "matrix_multiply",
            "rank",
            "rref",
        ],
        matrix.run,
    ),
    **dict.fromkeys(
        [
            "mean",
            "median",
            "mode",
            "quartiles",
            "standard_deviation",
            "variance",
            "z_score",
        ],
        stat.run,
    ),
    **dict.fromkeys(
        [
            "cumulative_probability",
            "distribution",
            "expected_value",
            "interval_probability",
            "point_probability",
            "tail_probability",
            "variance_probability",
        ],
        probability.run,
    ),
    **dict.fromkeys(
        [
            "circle",
            "distance",
            "intersection",
            "line",
            "midpoint",
            "slope",
        ],
        geometry.run,
    ),
    **dict.fromkeys(
        [
            "combination",
            "gcd",
            "is_prime",
            "lcm",
            "modular",
            "permutation",
            "prime_factorization",
        ],
        discrete.run,
    ),
}


def run(request: MathRequest) -> MathResult:
    """Dispatch a fixed CAS operation without evaluating arbitrary code."""
    handler = GROUPS.get(request.operation)

    if handler is None:
        return inconclusive(request, f"Unsupported operation: {request.operation}")

    return handler(request)
