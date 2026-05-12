"""Geometry CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, result, step
from cas.schema import MathExpression, MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run point, line, circle, and intersection geometry operations."""
    operation = request.operation
    points = [parse.point(point) for point in request.points]
    x, y = sp.symbols("x y")

    if operation == "distance":
        _require_points(points, 2)
        output = points[0].distance(points[1])
        steps = _distance_steps(points[0], points[1], output)
    elif operation == "midpoint":
        _require_points(points, 2)
        output = sp.Segment(points[0], points[1]).midpoint
        steps = []
    elif operation == "slope":
        _require_points(points, 2)
        output = _slope(points[0], points[1])
        steps = []
    elif operation == "line":
        _require_points(points, 2)
        output = _line_equation(points[0], points[1], x, y)
        steps = []
    elif operation == "circle":
        _require_points(points, 2)
        radius = points[0].distance(points[1])
        output = (x - points[0].x) ** 2 + (y - points[0].y) ** 2 - radius**2
        steps = []
    elif operation == "intersection":
        output = _intersection(request)
        if output is None:
            return result(
                request,
                status="inconclusive",
                primary=_display_input(points, request.expressions),
                secondary=expression_text(
                    "infinitely many intersections",
                    "\\text{infinitely many intersections}",
                ),
                reason="The equations do not determine a finite intersection point.",
            )

        steps = []
    else:
        raise ValueError(f"Unsupported geometry operation: {operation}")

    return result(
        request,
        status="verified",
        primary=_display_input(points, request.expressions),
        secondary=_display_output(output),
        reason="The geometry operation was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _display_input(points: list[sp.Point2D], expressions: list[str]) -> MathExpression:
    """Render geometry inputs without exposing internal SymPy object names."""
    if points:
        return _display_points(points)

    return expression_text(", ".join(expressions), ", ".join(expressions))


def _display_output(value: object) -> object:
    """Render geometry outputs without exposing internal SymPy object names."""
    if isinstance(value, sp.Point2D):
        return _display_point(value)

    if isinstance(value, list) and all(
        isinstance(point, sp.Point2D) for point in value
    ):
        return _display_points(value)

    return value


def _display_points(points: list[sp.Point2D]) -> MathExpression:
    """Render one or more points in coordinate notation."""
    if not points:
        return expression_text("empty set", "\\varnothing")

    return expression_text(
        ", ".join(_point_text(point) for point in points),
        ", ".join(_point_latex(point) for point in points),
    )


def _display_point(point: sp.Point2D) -> MathExpression:
    """Render a single point in coordinate notation."""
    return expression_text(_point_text(point), _point_latex(point))


def _point_text(point: sp.Point2D) -> str:
    """Render point coordinates as plain text."""
    return f"({point.x}, {point.y})"


def _point_latex(point: sp.Point2D) -> str:
    """Render point coordinates as LaTeX."""
    return f"\\left({sp.latex(point.x)}, {sp.latex(point.y)}\\right)"


def _distance_steps(start: sp.Point2D, end: sp.Point2D, output: sp.Expr) -> list:
    """Create the point-distance formula step."""
    dx = _difference(end.x, start.x)
    dy = _difference(end.y, start.y)
    formula = expression_text(
        f"sqrt(({dx})^2 + ({dy})^2)",
        f"\\sqrt{{{sp.latex(dx)}^2 + {sp.latex(dy)}^2}}",
    )

    return [step("distance", primary=formula, relation=EQUALS, secondary=output)]


def _intersection(request: MathRequest) -> list[sp.Point] | None:
    """Find intersections from equations or two point-defined lines."""
    x, y = sp.symbols("x y")

    if len(request.expressions) >= 2:
        equations = [parse.equation(value) for value in request.expressions]
        solved = sp.solve(equations, [x, y], dict=True)

        return _intersection_points(solved, x, y)

    points = [parse.point(point) for point in request.points]
    _require_points(points, 4)
    equations = [
        _line_equation(points[0], points[1], x, y),
        _line_equation(points[2], points[3], x, y),
    ]
    solved = sp.solve(equations, [x, y], dict=True)

    return _intersection_points(solved, x, y)


def _intersection_points(
    solved: list[dict[sp.Symbol, sp.Expr]], x: sp.Symbol, y: sp.Symbol
) -> list[sp.Point] | None:
    """Render only finite point intersections from solved coordinate dictionaries."""
    points = []
    for solution in solved:
        if x not in solution or y not in solution:
            return None

        points.append(sp.Point(solution[x], solution[y]))

    return points


def _require_points(points: list[sp.Point2D], count: int) -> None:
    """Ensure a geometry operation received enough points."""
    if len(points) < count:
        raise ValueError(f"At least {count} points are required.")


def _slope(start: sp.Point2D, end: sp.Point2D) -> sp.Expr:
    """Compute slope from two points."""
    dy = _difference(end.y, start.y)
    dx = _difference(end.x, start.x)
    if dx == 0:
        raise ValueError("Slope is undefined for a vertical line.")

    return sp.simplify(sp.Mul(dy, sp.Pow(dx, -1)))


def _line_equation(
    start: sp.Point2D, end: sp.Point2D, x: sp.Symbol, y: sp.Symbol
) -> sp.Expr:
    """Build an implicit line equation from two points."""
    left = sp.Mul(_difference(end.y, start.y), _difference(x, start.x))
    right = sp.Mul(_difference(end.x, start.x), _difference(y, start.y))

    return sp.expand(_difference(left, right))


def _difference(left: object, right: object) -> sp.Expr:
    """Subtract two SymPy-compatible values through the shared parser."""
    left_expr = parse.expression(str(left))
    right_expr = parse.expression(str(right))

    return sp.expand(sp.Add(left_expr, sp.Mul(-1, right_expr)))
