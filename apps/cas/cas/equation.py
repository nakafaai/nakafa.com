"""Equation, inequality, and root solving operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import item, result
from cas.schema import MathRequest, MathResult


def solve(request: MathRequest) -> MathResult:
    """Solve equations, inequalities, or systems for requested variables."""
    variables = parse.symbols(request.variables)
    equations = request.expressions or [request.expression or ""]
    parsed = [parse.equation(value) for value in equations]

    if len(parsed) == 1 and isinstance(parsed[0], sp.core.relational.Relational):
        relation = parsed[0]
        variable = variables[0]

        if isinstance(relation, sp.Equality):
            solved = sp.solve(relation, variable)
        else:
            solved = sp.solve_univariate_inequality(relation, variable)

        return result(
            request,
            status="verified",
            primary=relation,
            secondary=solved,
            reason="SymPy solved the equation or inequality.",
        )

    solved = sp.solve(parsed, variables, dict=True)

    return result(
        request,
        status="verified",
        primary=parsed,
        reason="SymPy solved the system.",
        items=[item("solution", solution) for solution in solved],
    )


def roots(request: MathRequest) -> MathResult:
    """Find polynomial roots and multiplicities."""
    variable = parse.symbol(request.variable)
    expr = parse.first_expression(request)
    roots_result = sp.roots(expr, variable)

    return result(
        request,
        status="verified",
        primary=expr,
        reason="SymPy found polynomial roots and multiplicities.",
        items=[
            item("root", f"{root}: {multiplicity}")
            for root, multiplicity in roots_result.items()
        ],
    )
