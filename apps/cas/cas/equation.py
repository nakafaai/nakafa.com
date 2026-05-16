"""Equation, inequality, and root solving operations backed by SymPy."""

import sympy as sp
from sympy.core.relational import Relational

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")
IMPLIES = expression_text("becomes", "\\Rightarrow")


def solve(request: MathRequest) -> MathResult:
    """Solve equations, inequalities, or systems for requested variables."""
    equations = request.expressions or [request.expression or ""]
    variables, parsed = _solve_variables(request, equations)

    if len(parsed) == 1 and isinstance(parsed[0], sp.core.relational.Relational):
        relation = parsed[0]
        variable = variables[0]

        if isinstance(relation, sp.Equality):
            solved = sp.solve(relation, variable)
            steps = _solve_equality_steps(relation, solved)
        else:
            solved = sp.solve_univariate_inequality(relation, variable)
            steps = [
                step("solve", primary=relation, relation=IMPLIES, secondary=solved)
            ]

        return result(
            request,
            status="verified",
            primary=relation,
            secondary=solved,
            reason="The equation or inequality was solved exactly.",
            steps=steps,
            stepStatus="partial" if steps else "unavailable",
        )

    solved = sp.solve(parsed, variables, dict=True)

    return result(
        request,
        status="verified",
        primary=parsed,
        reason="The system was solved exactly.",
        items=[item("solution", solution) for solution in solved],
    )


def _solve_variables(
    request: MathRequest, equations: list[str]
) -> tuple[list[sp.Symbol], list[sp.Expr | sp.Equality | Relational]]:
    """Use explicit solve variables or infer one unambiguous variable."""
    if request.variables:
        return parse.symbols(request.variables), [
            parse.equation(value) for value in equations
        ]

    variable, parsed = parse.symbol_from_equations(request.variable, equations)
    return [variable], parsed


def _solve_equality_steps(relation: sp.Equality, solved: list) -> list:
    """Create compact factoring evidence for one-variable polynomial equations."""
    left = parse.expression(str(relation.lhs))
    right = parse.expression(str(relation.rhs))
    expression = sp.expand(left - right)
    factored = sp.factor(expression)

    if factored == expression:
        return [step("solve", primary=relation, relation=IMPLIES, secondary=solved)]

    return [
        step("factor", primary=expression, relation=EQUALS, secondary=factored),
        step(
            "solve",
            primary=sp.Eq(factored, 0, evaluate=False),
            relation=IMPLIES,
            secondary=solved,
        ),
    ]


def roots(request: MathRequest) -> MathResult:
    """Find polynomial roots and multiplicities."""
    variable, parsed_values = parse.symbol_from_equations(
        request.variable, [request.expression or ""]
    )
    parsed = parsed_values[0]

    if isinstance(parsed, sp.Equality):
        left = parse.expression(str(parsed.lhs))
        right = parse.expression(str(parsed.rhs))
        expr = sp.expand(left - right)
    else:
        raise ValueError("Roots require an expression or equation.")

    if not expr.is_polynomial(variable):
        raise ValueError("Roots require a polynomial expression or equation.")

    polynomial = sp.Poly(expr, variable)
    roots_result = sp.roots(polynomial, variable)
    _require_complete_roots(polynomial, roots_result)

    return result(
        request,
        status="verified",
        primary=expr,
        reason="Polynomial roots and multiplicities were checked exactly.",
        items=[
            item("root", f"{root}: {multiplicity}")
            for root, multiplicity in roots_result.items()
        ],
    )


def _require_complete_roots(
    polynomial: sp.Poly, roots_result: dict[sp.Expr, int]
) -> None:
    """Reject incomplete symbolic roots before returning verified evidence."""
    returned_roots = sum(roots_result.values())
    if returned_roots == polynomial.degree():
        return

    raise ValueError("Roots could not be expressed exactly.")
