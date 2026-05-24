"""Discrete math CAS operations backed by SymPy."""

import math

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathExpression, MathItem, MathRequest, MathResult, MathStep

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run exact number-theory and combinatorics operations."""
    operation = request.operation

    if operation == "gcd":
        values = _integer_values(request.values)
        primary = _function_expression("gcd", values)
        output = sp.gcd_list(values)
        steps = _gcd_steps(values, output)
    elif operation == "lcm":
        values = _integer_values(request.values)
        primary = _function_expression("lcm", values)
        output = sp.lcm_list(values)
        steps = _lcm_steps(values, output)
    elif operation == "prime_factorization":
        value = _integer(request.n)
        if value == 0:
            raise ValueError("Prime factorization requires a nonzero integer.")

        # `factorint` returns the prime-power dictionary shape used below.
        factors = sp.factorint(value)
        factorization = _factorization_expression(factors)

        return result(
            request,
            status="verified",
            primary=value,
            reason="The prime factorization was checked exactly.",
            secondary=factorization,
            items=[
                item("factor", _factor_expression(prime, power))
                for prime, power in _ordered_factors(factors)
            ],
            steps=[
                step(
                    "prime_factorization",
                    primary=value,
                    relation=EQUALS,
                    secondary=factorization,
                    reason=_prime_factorization_reason(value, factors),
                )
            ],
            stepStatus="complete",
        )
    elif operation == "is_prime":
        value = _integer(request.n)
        primary = value
        # SymPy's primality API gives a deterministic boolean for exact integers.
        output = sp.isprime(value)
        steps = [_is_prime_step(value, output)]
    elif operation == "modular":
        value = _integer(request.n)
        modulus = _nonzero_integer(request.modulus)
        primary = _modular_expression(value, modulus)
        output = value % modulus
        steps = _modular_steps(value, modulus, output)
    elif operation == "permutation":
        n, k = _bounded_count(request.n, request.k, "Permutation")
        primary = _permutation_expression(n, k)
        output = sp.factorial(n) / sp.factorial(n - k)
        steps = _permutation_steps(n, k, output)
    elif operation == "combination":
        n, k = _bounded_count(request.n, request.k, "Combination")
        primary = _combination_expression(n, k)
        output = sp.binomial(n, k)
        steps = _combination_steps(n, k, output)
    else:
        raise ValueError(f"Unsupported discrete operation: {operation}")

    return result(
        request,
        status="verified",
        primary=primary,
        secondary=output,
        reason="The discrete math operation was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _integer(value: str | None) -> int:
    """Parse an exact integer operand without silently truncating values."""
    parsed = parse.expression(value)
    if parsed.is_integer is not True:
        raise ValueError("Discrete operands must be integers.")

    return int(parsed)


def _integer_values(values: list[str]) -> list[int]:
    """Parse a non-empty list of exact integer operands."""
    if not values:
        raise ValueError("Discrete value operations require at least one integer.")

    return [_integer(value) for value in values]


def _nonzero_integer(value: str | None) -> int:
    """Parse an integer operand that cannot be zero."""
    parsed = _integer(value)
    if parsed == 0:
        raise ValueError("Modulus must be nonzero.")

    return parsed


def _bounded_count(
    n_value: str | None, k_value: str | None, name: str
) -> tuple[int, int]:
    """Parse finite counting operands with the standard 0 <= k <= n bound."""
    n = _integer(n_value)
    k = _integer(k_value)
    if n < 0 or k < 0 or k > n:
        raise ValueError(f"{name} requires integer operands with 0 <= k <= n.")

    return n, k


def _operation_steps(name: str, values: list[int], output: object) -> list[MathStep]:
    """Create one function-style step for exact integer-list operations."""
    return [
        step(
            name,
            primary=_function_expression(name, values),
            relation=EQUALS,
            secondary=output,
            reason=(
                f"Reduce the integer list using the associative {name} operation."
            ),
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
    if not factors:
        return expression_text("1", "1")

    pieces = [
        f"{prime}^{power}" if power > 1 else str(prime)
        for prime, power in _ordered_factors(factors)
    ]
    latex_pieces = [
        f"{prime}^{{{power}}}" if power > 1 else str(prime)
        for prime, power in _ordered_factors(factors)
    ]

    return expression_text("*".join(pieces), " \\cdot ".join(latex_pieces))


def _ordered_factors(factors: dict[int, int]) -> list[tuple[int, int]]:
    """Keep the sign unit first, then render prime factors in ascending order."""
    return sorted(
        ((int(prime), int(power)) for prime, power in factors.items()),
        key=lambda factor: (factor[0] != -1, abs(factor[0])),
    )


def _factor_expression(prime: int, power: int) -> MathExpression:
    """Render one prime factor with exponent-aware LaTeX."""
    if power == 1:
        return expression_text(str(prime), str(prime))

    return expression_text(f"{prime}^{power}", f"{prime}^{{{power}}}")


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


def _combination_formula_expression(n: int, k: int) -> MathExpression:
    """Render the factorial form of n choose k after substituting values."""
    remaining = n - k

    return expression_text(
        f"{n}!/({k}!*{remaining}!)",
        f"\\frac{{{n}!}}{{{k}! \\cdot {remaining}!}}",
    )


def _permutation_formula_expression(n: int, k: int) -> MathExpression:
    """Render the factorial form of n permute k after substituting values."""
    remaining = n - k

    return expression_text(
        f"{n}!/{remaining}!",
        f"\\frac{{{n}!}}{{{remaining}!}}",
    )


def _combination_steps(n: int, k: int, output: object) -> list[MathStep]:
    """Create formula-substitution steps for combinations."""
    formula = _combination_formula_expression(n, k)

    return [
        step(
            "combination",
            primary=_combination_expression(n, k),
            relation=EQUALS,
            secondary=formula,
            reason=(
                "Use the combination formula because order does not matter."
            ),
        ),
        step(
            "evaluate",
            primary=formula,
            relation=EQUALS,
            secondary=output,
            reason="Evaluate the factorials and simplify exactly.",
        ),
    ]


def _permutation_steps(n: int, k: int, output: object) -> list[MathStep]:
    """Create formula-substitution steps for permutations."""
    formula = _permutation_formula_expression(n, k)

    return [
        step(
            "permutation",
            primary=_permutation_expression(n, k),
            relation=EQUALS,
            secondary=formula,
            reason="Use the permutation formula because order matters.",
        ),
        step(
            "evaluate",
            primary=formula,
            relation=EQUALS,
            secondary=output,
            reason="Evaluate the factorials and simplify exactly.",
        ),
    ]


def _modular_steps(value: int, modulus: int, output: object) -> list[MathStep]:
    """Create a modular arithmetic step with the division algorithm context."""
    quotient, remainder = divmod(value, modulus)
    division = expression_text(
        f"{value} = {quotient}*{modulus} + {remainder}",
        f"{value} = {quotient} \\cdot {modulus} + {remainder}",
    )

    return [
        step(
            "modular",
            primary=_modular_expression(value, modulus),
            relation=EQUALS,
            secondary=output,
            items=[item("division", division)],
            reason=(
                "Use the division algorithm; the remainder is the value modulo "
                "the modulus."
            ),
        )
    ]


def _is_prime_step(value: int, output: bool) -> MathStep:
    """Create a primality step with the exact reason for the conclusion."""
    step_items: list[MathItem] = []

    if value < 2:
        reason = "Prime numbers are integers greater than 1."
    elif output and value <= 3:
        reason = f"{value} has exactly two positive divisors: 1 and {value}."
    elif output:
        checked_divisors = list(sp.primerange(2, math.isqrt(value) + 1))
        if checked_divisors:
            rendered_divisors = ", ".join(str(divisor) for divisor in checked_divisors)
            step_items.append(
                item(
                    "checked_divisors",
                    expression_text(rendered_divisors, rendered_divisors),
                )
            )
        reason = (
            f"No prime divisor up to sqrt({value}) divides {value}, so it is prime."
        )
    else:
        divisor = _smallest_prime_factor(value)
        if divisor is None:
            reason = "Prime numbers are integers greater than 1."
        else:
            step_items.append(item("divisor", divisor))
            reason = f"{divisor} divides {value}, so {value} is not prime."

    return step(
        "is_prime",
        primary=value,
        relation=expression_text("is", "\\text{is}"),
        secondary=expression_text(
            "prime" if output else "not prime",
            "\\text{prime}" if output else "\\text{not prime}",
        ),
        items=step_items,
        reason=reason,
    )


def _smallest_prime_factor(value: int) -> int | None:
    """Return the smallest prime factor for a composite integer when available."""
    if abs(value) < 2:
        return None

    factors = _ordered_factors(sp.factorint(abs(value)))
    return next((prime for prime, _power in factors if prime > 1), None)


def _lcm_steps(values: list[int], output: object) -> list[MathStep]:
    """Create lcm evidence, using the gcd identity for two integers."""
    if len(values) != 2:
        return _operation_steps("lcm", values, output)

    left, right = values
    primary = _function_expression("lcm", values)

    if left == 0 and right == 0:
        return [
            step(
                "lcm",
                primary=primary,
                relation=EQUALS,
                secondary=output,
                reason=(
                    "Both inputs are zero, so the least common multiple is 0 "
                    "in this exact integer convention."
                ),
            )
        ]

    gcd_value = sp.gcd(abs(left), abs(right))

    return [
        step(
            "lcm",
            primary=primary,
            relation=EQUALS,
            secondary=output,
            items=[
                item("gcd", gcd_value),
                item("identity", _lcm_identity_expression(left, right)),
            ],
            reason=(
                "Use the identity lcm(a, b) = |a*b| / gcd(a, b) for two "
                "integers."
            ),
        )
    ]


def _lcm_identity_expression(left: int, right: int) -> MathExpression:
    """Render the two-integer lcm identity with substituted inputs."""
    return expression_text(
        f"|{left}*{right}|/gcd({left}, {right})",
        (
            "\\frac{"
            f"\\left|{left} \\cdot {right}\\right|"
            "}{"
            f"\\gcd\\left({left}, {right}\\right)"
            "}"
        ),
    )


def _prime_factorization_reason(value: int, factors: dict[int, int]) -> str:
    """Return the student-facing reason for one prime factorization step."""
    if value == 1:
        return "1 has no prime factors, so the empty product is 1."

    if value == -1:
        return "-1 is the sign unit and has no positive prime factors."

    if -1 in factors:
        return (
            "Separate the negative sign, then combine equal positive prime "
            "factors as powers."
        )

    return "Break the integer into prime factors and combine repeated primes as powers."


def _gcd_steps(values: list[int], output: object) -> list[MathStep]:
    """Create Euclidean algorithm steps for two positive integers."""
    if len(values) != 2:
        return _operation_steps("gcd", values, output)

    left, right = sorted((abs(values[0]), abs(values[1])), reverse=True)
    primary = _function_expression("gcd", values)

    if left == 0:
        return [
            step(
                "gcd",
                primary=primary,
                relation=EQUALS,
                secondary=output,
                reason="The gcd of two zeros is 0 in this exact integer convention.",
            )
        ]

    if right == 0:
        return [
            step(
                "gcd",
                primary=primary,
                relation=EQUALS,
                secondary=output,
                reason="The gcd of an integer and 0 is the integer's absolute value.",
            )
        ]

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
                reason=(
                    "Use Euclidean division; replacing the larger number by "
                    "the remainder preserves the gcd."
                ),
            )
        )
        left, right = right, remainder

    steps.append(
        step(
            "gcd",
            primary=primary,
            relation=EQUALS,
            secondary=output,
            reason="When the remainder is 0, the last nonzero divisor is the gcd.",
        )
    )

    return steps
