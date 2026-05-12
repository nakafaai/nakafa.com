"""Descriptive statistics CAS operations backed by SymPy."""

from collections import Counter

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run exact descriptive statistics on provided values."""
    values = [parse.expression(value) for value in request.values]
    if not values:
        raise ValueError("Values are required.")

    operation = request.operation
    sorted_values = sorted(values, key=lambda value: float(value))

    if operation == "mean":
        output = sum(values) / len(values)
        steps = [_mean_step(values, output)]
    elif operation == "median":
        output = _median(sorted_values)
        steps = []
    elif operation == "mode":
        return result(
            request,
            status="verified",
            primary=values,
            reason="Modes were computed from the exact values.",
            items=[item("mode", mode) for mode in _modes(values)],
        )
    elif operation == "variance":
        mean = sum(values) / len(values)
        output = sum((value - mean) ** 2 for value in values) / len(values)
        steps = [_mean_step(values, mean), *_variance_steps(values, mean, output)]
    elif operation == "standard_deviation":
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        output = sp.sqrt(variance)
        steps = [
            _mean_step(values, mean),
            *_variance_steps(values, mean, variance),
            step(
                "standard-deviation",
                primary=expression_text(
                    f"sqrt({variance})", f"\\sqrt{{{sp.latex(variance)}}}"
                ),
                relation=EQUALS,
                secondary=output,
            ),
        ]
    elif operation == "quartiles":
        q1, q2, q3 = _quartiles(sorted_values)

        return result(
            request,
            status="verified",
            primary=values,
            reason="Quartiles were computed from the sorted values.",
            items=[
                item("q1", q1),
                item("q2", q2),
                item("q3", q3),
            ],
        )
    elif operation == "z_score":
        target = parse.expression(request.expression)
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        if variance == 0:
            raise ValueError("Z-score is undefined when variance is zero.")

        output = (target - mean) / sp.sqrt(variance)
        steps = []
    else:
        raise ValueError(f"Unsupported statistics operation: {operation}")

    return result(
        request,
        status="verified",
        primary=values,
        secondary=output,
        reason="The statistic was checked from exact values.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _mean_step(values: list[sp.Expr], output: object):
    """Create the arithmetic mean formula step."""
    total = sum(values)
    formula = expression_text(
        f"({total})/{len(values)}",
        f"\\frac{{{sp.latex(total)}}}{{{len(values)}}}",
    )

    return step("mean", primary=formula, relation=EQUALS, secondary=output)


def _variance_steps(values: list[sp.Expr], mean: object, output: object) -> list:
    """Create a compact population variance formula step."""
    mean_expr = sp.sympify(mean)
    squared_distances = [sp.expand((value - mean_expr) ** 2) for value in values]
    total = sum(squared_distances)
    formula = expression_text(
        f"({total})/{len(values)}",
        f"\\frac{{{sp.latex(total)}}}{{{len(values)}}}",
    )

    return [step("variance", primary=formula, relation=EQUALS, secondary=output)]


def _median(values: list[sp.Expr]) -> sp.Expr:
    """Compute the median of a sorted exact-value list."""
    if not values:
        raise ValueError("Median requires at least one value.")

    middle = len(values) // 2

    if len(values) % 2 == 1:
        return values[middle]

    return (values[middle - 1] + values[middle]) / 2


def _quartiles(values: list[sp.Expr]) -> tuple[sp.Expr, sp.Expr, sp.Expr]:
    """Compute Tukey-style quartiles for a sorted exact-value list."""
    if len(values) == 1:
        return values[0], values[0], values[0]

    lower = values[: len(values) // 2]
    upper = values[(len(values) + 1) // 2 :]

    return _median(lower), _median(values), _median(upper)


def _modes(values: list[sp.Expr]) -> list[sp.Expr]:
    """Return every value tied for highest frequency."""
    counts = Counter(values)
    highest = max(counts.values())

    return [value for value, count in counts.items() if count == highest]
