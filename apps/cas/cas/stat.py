"""Descriptive statistics CAS operations backed by SymPy."""

from collections import Counter

import sympy as sp

from cas import parse
from cas.format import item, result
from cas.schema import MathRequest, MathResult


def run(request: MathRequest) -> MathResult:
    """Run exact descriptive statistics on provided values."""
    values = [parse.expression(value) for value in request.values]
    if not values:
        raise ValueError("Values are required.")

    operation = request.operation
    sorted_values = sorted(values, key=lambda value: float(value))

    if operation == "mean":
        output = sum(values) / len(values)
    elif operation == "median":
        output = _median(sorted_values)
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
    elif operation == "standard_deviation":
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        output = sp.sqrt(variance)
    elif operation == "quartiles":
        return result(
            request,
            status="verified",
            primary=values,
            reason="Quartiles were computed from the sorted values.",
            items=[
                item("q1", _median(sorted_values[: len(sorted_values) // 2])),
                item("q2", _median(sorted_values)),
                item("q3", _median(sorted_values[(len(sorted_values) + 1) // 2 :])),
            ],
        )
    elif operation == "z_score":
        target = parse.expression(request.expression)
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        output = (target - mean) / sp.sqrt(variance)
    else:
        raise ValueError(f"Unsupported statistics operation: {operation}")

    return result(
        request,
        status="verified",
        primary=values,
        secondary=output,
        reason="SymPy computed the statistic from exact values.",
    )


def _median(values: list[sp.Expr]) -> sp.Expr:
    """Compute the median of a sorted exact-value list."""
    middle = len(values) // 2

    if len(values) % 2 == 1:
        return values[middle]

    return (values[middle - 1] + values[middle]) / 2


def _modes(values: list[sp.Expr]) -> list[sp.Expr]:
    """Return every value tied for highest frequency."""
    counts = Counter(values)
    highest = max(counts.values())

    return [value for value, count in counts.items() if count == highest]
