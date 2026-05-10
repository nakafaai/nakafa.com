"""Discrete math CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import item, result
from cas.schema import MathRequest, MathResult


def run(request: MathRequest) -> MathResult:
    """Run exact number-theory and combinatorics operations."""
    operation = request.operation

    if operation == "gcd":
        output = sp.gcd_list([int(parse.expression(value)) for value in request.values])
    elif operation == "lcm":
        output = sp.lcm_list([int(parse.expression(value)) for value in request.values])
    elif operation == "prime_factorization":
        return result(
            request,
            status="verified",
            primary=parse.expression(request.n),
            reason="SymPy computed the prime factorization.",
            items=[
                item("factor", f"{prime}^{power}")
                for prime, power in sp.factorint(
                    int(parse.expression(request.n))
                ).items()
            ],
        )
    elif operation == "is_prime":
        output = sp.isprime(int(parse.expression(request.n)))
    elif operation == "modular":
        output = int(parse.expression(request.n)) % int(
            parse.expression(request.modulus)
        )
    elif operation == "permutation":
        output = sp.factorial(parse.expression(request.n)) / sp.factorial(
            parse.expression(request.n) - parse.expression(request.k)
        )
    elif operation == "combination":
        output = sp.binomial(parse.expression(request.n), parse.expression(request.k))
    else:
        raise ValueError(f"Unsupported discrete operation: {operation}")

    return result(
        request,
        status="verified",
        primary=request.values or request.n or operation,
        secondary=output,
        reason="SymPy completed the discrete math operation.",
    )
