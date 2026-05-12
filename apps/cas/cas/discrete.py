"""Discrete math CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathExpression, MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run exact number-theory and combinatorics operations."""
    operation = request.operation

    if operation == "gcd":
        values = [int(parse.expression(value)) for value in request.values]
        output = sp.gcd_list(values)
        steps = _gcd_steps(values, output)
    elif operation == "lcm":
        values = [int(parse.expression(value)) for value in request.values]
        output = sp.lcm_list(values)
        steps = _operation_steps("lcm", values, output)
    elif operation == "prime_factorization":
        value = int(parse.expression(request.n))
        factors = sp.factorint(value)
        factorization = _factorization_expression(factors)

        return result(
            request,
            status="verified",
            primary=value,
            reason="The prime factorization was checked exactly.",
            secondary=factorization,
            items=[
                item("factor", f"{prime}^{power}") for prime, power in factors.items()
            ],
            steps=[
                step(
                    "prime_factorization",
                    primary=value,
                    relation=EQUALS,
                    secondary=factorization,
                )
            ],
            stepStatus="complete",
        )
    elif operation == "is_prime":
        value = int(parse.expression(request.n))
        output = sp.isprime(value)
        steps = [
            step(
                "is_prime",
                primary=value,
                relation=expression_text("is", "\\text{is}"),
                secondary=expression_text(
                    "prime" if output else "not prime",
                    "\\text{prime}" if output else "\\text{not prime}",
                ),
            )
        ]
    elif operation == "modular":
        value = int(parse.expression(request.n))
        modulus = int(parse.expression(request.modulus))
        primary = _modular_expression(value, modulus)
        output = value % modulus
        steps = [step("modular", primary=primary, relation=EQUALS, secondary=output)]
    elif operation == "permutation":
        n = parse.expression(request.n)
        k = parse.expression(request.k)
        primary = _permutation_expression(n, k)
        output = sp.factorial(n) / sp.factorial(n - k)
        steps = [
            step("permutation", primary=primary, relation=EQUALS, secondary=output)
        ]
    elif operation == "combination":
        n = parse.expression(request.n)
        k = parse.expression(request.k)
        primary = _combination_expression(n, k)
        output = sp.binomial(n, k)
        steps = [
            step("combination", primary=primary, relation=EQUALS, secondary=output)
        ]
    else:
        raise ValueError(f"Unsupported discrete operation: {operation}")

    return result(
        request,
        status="verified",
        primary=(
            steps[-1].primary if steps else request.values or request.n or operation
        ),
        secondary=output,
        reason="The discrete math operation was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _operation_steps(name: str, values: list[int], output: object) -> list:
    """Create one function-style step for exact integer-list operations."""
    return [
        step(
            name,
            primary=_function_expression(name, values),
            relation=EQUALS,
            secondary=output,
        )
    ]


def _function_expression(name: str, values: list[int]) -> MathExpression:
    """Render a readable function call such as gcd(84, 30)."""
    text = f"{name}({', '.join(str(value) for value in values)})"
    latex_values = ", ".join(str(value) for value in values)

    return expression_text(
        text, f"\\operatorname{{{name}}}\\left({latex_values}\\right)"
    )


def _factorization_expression(factors: dict[int, int]) -> MathExpression:
    """Render a prime factorization as one multiplication expression."""
    pieces = [
        f"{prime}^{power}" if power > 1 else str(prime)
        for prime, power in factors.items()
    ]
    latex_pieces = [
        f"{prime}^{{{power}}}" if power > 1 else str(prime)
        for prime, power in factors.items()
    ]

    return expression_text("*".join(pieces), " \\cdot ".join(latex_pieces))


def _modular_expression(value: int, modulus: int) -> MathExpression:
    """Render modular arithmetic without implying plain equality."""
    return expression_text(
        f"{value} mod {modulus}",
        f"{value} \\bmod {modulus}",
    )


def _combination_expression(n: object, k: object) -> MathExpression:
    """Render a combination count in standard binomial notation."""
    return expression_text(
        f"C({n}, {k})",
        f"\\binom{{{sp.latex(n)}}}{{{sp.latex(k)}}}",
    )


def _permutation_expression(n: object, k: object) -> MathExpression:
    """Render a permutation count in function notation."""
    return expression_text(
        f"P({n}, {k})",
        f"P\\left({sp.latex(n)}, {sp.latex(k)}\\right)",
    )


def _gcd_steps(values: list[int], output: object) -> list:
    """Create Euclidean algorithm steps for two positive integers."""
    if len(values) != 2:
        return _operation_steps("gcd", values, output)

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
