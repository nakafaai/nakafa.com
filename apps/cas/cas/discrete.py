"""Discrete math CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run exact number-theory and combinatorics operations."""
    operation = request.operation

    if operation == "gcd":
        values = [int(parse.expression(value)) for value in request.values]
        output = sp.gcd_list(values)
        steps = _gcd_steps(values, output)
    elif operation == "lcm":
        output = sp.lcm_list([int(parse.expression(value)) for value in request.values])
        steps = []
    elif operation == "prime_factorization":
        return result(
            request,
            status="verified",
            primary=parse.expression(request.n),
            reason="The prime factorization was checked exactly.",
            items=[
                item("factor", f"{prime}^{power}")
                for prime, power in sp.factorint(
                    int(parse.expression(request.n))
                ).items()
            ],
        )
    elif operation == "is_prime":
        output = sp.isprime(int(parse.expression(request.n)))
        steps = []
    elif operation == "modular":
        output = int(parse.expression(request.n)) % int(
            parse.expression(request.modulus)
        )
        steps = []
    elif operation == "permutation":
        output = sp.factorial(parse.expression(request.n)) / sp.factorial(
            parse.expression(request.n) - parse.expression(request.k)
        )
        steps = []
    elif operation == "combination":
        output = sp.binomial(parse.expression(request.n), parse.expression(request.k))
        steps = []
    else:
        raise ValueError(f"Unsupported discrete operation: {operation}")

    return result(
        request,
        status="verified",
        primary=request.values or request.n or operation,
        secondary=output,
        reason="The discrete math operation was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _gcd_steps(values: list[int], output: object) -> list:
    """Create Euclidean algorithm steps for two positive integers."""
    if len(values) != 2:
        return []

    left, right = sorted((abs(values[0]), abs(values[1])), reverse=True)
    steps = []

    while right != 0:
        quotient, remainder = divmod(left, right)
        steps.append(
            step(
                "gcd",
                primary=expression_text(
                    f"{left} = {quotient}*{right} + {remainder}",
                    f"{left} = {quotient} \\cdot {right} + {remainder}",
                ),
            )
        )
        left, right = right, remainder

    steps.append(
        step(
            "gcd",
            primary=expression_text(
                f"gcd({values[0]}, {values[1]})",
                f"\\gcd\\left({values[0]}, {values[1]}\\right)",
            ),
            relation=EQUALS,
            secondary=output,
        )
    )

    return steps
