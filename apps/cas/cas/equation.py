"""Equation, inequality, and root solving operations backed by SymPy."""

import sympy as sp
from sympy.core.relational import Relational

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")
IMPLIES = expression_text("becomes", "\\Rightarrow")
SOLUTION_SET_UNAVAILABLE = "The equation solution set could not be determined exactly."


class SolutionSetUnavailable(ValueError):
    """Raised when SymPy cannot represent the complete exact solution set."""


def solve(request: MathRequest) -> MathResult:
    """Solve equations, inequalities, or systems for requested variables."""
    equations = request.expressions or [request.expression or ""]
    variables, parsed = _solve_variables(request, equations)
    domain = _solution_domain(request)

    if (
        len(parsed) == 1
        and len(variables) == 1
        and isinstance(parsed[0], sp.core.relational.Relational)
    ):
        relation = parsed[0]
        variable = variables[0]

        if isinstance(relation, sp.Equality):
            try:
                solved = _solve_equality(relation, variable, domain)
            except SolutionSetUnavailable:
                return result(
                    request,
                    status="inconclusive",
                    primary=relation,
                    reason=SOLUTION_SET_UNAVAILABLE,
                )
            steps = _solve_equality_steps(relation, variable, solved)
        else:
            # SymPy intersects univariate inequality solutions with this domain.
            # https://docs.sympy.org/latest/modules/solvers/inequalities.html
            solved = sp.solve_univariate_inequality(
                relation,
                variable,
                domain=domain,
            )
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

    try:
        solved = _solve_system(request, parsed, variables, domain)
    except SolutionSetUnavailable:
        return result(
            request,
            status="inconclusive",
            primary=parsed,
            reason=SOLUTION_SET_UNAVAILABLE,
        )

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


def _solve_system(
    request: MathRequest,
    parsed: list[sp.Expr | sp.Equality | Relational],
    variables: list[sp.Symbol],
    domain: sp.Set,
):
    """Solve a system and enforce a requested single-variable domain."""
    if domain != sp.S.Reals:
        _require_bounded_system_variables(parsed, variables)

    solved = sp.solve(parsed, variables, dict=True)

    if domain == sp.S.Reals:
        return solved

    domain_variable = _system_domain_variable(request, variables)
    return _filter_solved_mappings(solved, domain_variable, domain)


def _require_bounded_system_variables(
    parsed: list[sp.Expr | sp.Equality | Relational],
    variables: list[sp.Symbol],
) -> None:
    """Require bounded systems to include every symbol used by the system."""
    missing = _system_symbols(parsed) - set(variables)
    if not missing:
        return

    raise ValueError("Bounded system solves require all solved variables.")


def _system_symbols(
    parsed: list[sp.Expr | sp.Equality | Relational],
) -> set[sp.Symbol]:
    """Return every symbolic variable present in a parsed system."""
    return {
        symbol
        for relation in parsed
        for symbol in relation.free_symbols
        if isinstance(symbol, sp.Symbol)
    }


def _system_domain_variable(
    request: MathRequest,
    variables: list[sp.Symbol],
) -> sp.Symbol:
    """Return the system variable constrained by lower or upper bounds."""
    if not request.variable:
        raise ValueError(
            "Domain variable is required when solving a system with bounds."
        )

    variable = parse.symbol(request.variable)
    if variable not in variables:
        raise ValueError("Domain variable must be one of the solved variables.")

    return variable


def _solution_domain(request: MathRequest) -> sp.Set:
    """Build the real solve domain from optional request bounds."""
    if request.lower is None and request.upper is None:
        return sp.S.Reals

    lower = parse.expression(request.lower) if request.lower is not None else -sp.oo
    upper = parse.expression(request.upper) if request.upper is not None else sp.oo

    return sp.Interval(
        lower,
        upper,
        left_open=request.lowerInclusive is False,
        right_open=request.upperInclusive is False,
    )


def _solve_equality(relation: sp.Equality, variable: sp.Symbol, domain: sp.Set):
    """Solve one equation without marking partial families as verified."""
    expression = _equality_expression(relation)

    if expression.is_polynomial(variable):
        solved = sp.solve(relation, variable)
        return _filter_solved_values(solved, domain)

    # `solveset` returns ConditionSet when it cannot represent the complete
    # exact set, so fallback logic must prove completeness before verification.
    # https://docs.sympy.org/latest/modules/solvers/solveset.html
    solved = sp.solveset(relation, variable, domain=domain)
    if isinstance(solved, sp.ConditionSet):
        product_solved = _solve_product_equality(expression, variable, domain)
        if product_solved is not None:
            return product_solved

        raise SolutionSetUnavailable(SOLUTION_SET_UNAVAILABLE)

    return solved


def _filter_solved_values(
    solved: list[sp.Expr],
    domain: sp.Set,
) -> list[sp.Expr]:
    """Keep only exactly validated finite solutions inside the solve domain."""
    if domain == sp.S.Reals:
        return solved

    return [value for value in solved if _is_inside_domain(value, domain)]


def _filter_solved_mappings(
    solved: list[dict[sp.Symbol, sp.Expr]],
    variable: sp.Symbol,
    domain: sp.Set,
) -> list[dict[sp.Symbol, sp.Expr]]:
    """Keep only exact system solutions whose constrained value is in domain."""
    filtered = []

    for solution in solved:
        value = solution.get(variable)
        if value is None:
            raise SolutionSetUnavailable(SOLUTION_SET_UNAVAILABLE)

        if _is_inside_domain(value, domain):
            filtered.append(solution)

    return filtered


def _solve_product_equality(
    expression: sp.Expr, variable: sp.Symbol, domain: sp.Set
) -> sp.Set | None:
    """Solve products when every factor is exact or proven nonzero."""
    assumed_variable = _domain_symbol(variable, domain)
    assumed_expression = expression.xreplace({variable: assumed_variable})
    factors = sp.factor(assumed_expression).as_ordered_factors()

    if len(factors) < 2:
        return None

    solutions = sp.S.EmptySet

    for factor in factors:
        if _is_definitely_nonzero(factor):
            continue

        factor_solutions = sp.solveset(factor, assumed_variable, domain=domain)
        if isinstance(factor_solutions, sp.ConditionSet):
            return None

        solutions = solutions.union(factor_solutions)

    return solutions


def _domain_symbol(variable: sp.Symbol, domain: sp.Set) -> sp.Symbol:
    """Create a symbol carrying assumptions known from the solve domain."""
    if domain.is_subset(sp.Interval.open(0, sp.oo)) is True:
        return sp.Symbol(str(variable), positive=True)

    return variable


def _is_definitely_nonzero(value: sp.Expr) -> bool:
    """Return whether a factor cannot be zero under current assumptions."""
    if value.is_zero is False:
        return True

    return sp.ask(sp.Q.nonzero(value)) is True


def _is_inside_domain(value: sp.Expr, domain: sp.Set) -> bool:
    """Return exact membership for one finite solution candidate."""
    contained = domain.contains(value)

    if contained is sp.S.true:
        return True

    if contained is sp.S.false:
        return False

    raise SolutionSetUnavailable(SOLUTION_SET_UNAVAILABLE)


def _equality_expression(relation: sp.Equality) -> sp.Expr:
    """Move one equality to a single expression equal to zero."""
    left = parse.expression(str(relation.lhs))
    right = parse.expression(str(relation.rhs))

    return sp.expand(left - right)


def _solve_equality_steps(
    relation: sp.Equality, variable: sp.Symbol, solved: object
) -> list:
    """Create compact factoring evidence for one-variable polynomial equations."""
    expression = _equality_expression(relation)

    if not expression.is_polynomial(variable):
        return [step("solve", primary=relation, relation=IMPLIES, secondary=solved)]

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
    if request.lower is not None or request.upper is not None:
        raise ValueError("Roots do not support solve-domain bounds.")

    variable, parsed_values = parse.symbol_from_equations(
        request.variable, [request.expression or ""]
    )
    parsed = parsed_values[0]

    if isinstance(parsed, sp.Equality):
        expr = _equality_expression(parsed)
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
