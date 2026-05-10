"""Geometry CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import result
from cas.schema import MathRequest, MathResult


def run(request: MathRequest) -> MathResult:
    """Run point, line, circle, and intersection geometry operations."""
    operation = request.operation
    points = [parse.point(point) for point in request.points]
    x, y = sp.symbols("x y")

    if operation == "distance":
        _require_points(points, 2)
        output = points[0].distance(points[1])
    elif operation == "midpoint":
        _require_points(points, 2)
        output = sp.Segment(points[0], points[1]).midpoint
    elif operation == "slope":
        _require_points(points, 2)
        output = _slope(points[0], points[1])
    elif operation == "line":
        _require_points(points, 2)
        output = _line_equation(points[0], points[1], x, y)
    elif operation == "circle":
        _require_points(points, 2)
        radius = points[0].distance(points[1])
        output = (x - points[0].x) ** 2 + (y - points[0].y) ** 2 - radius**2
    elif operation == "intersection":
        output = _intersection(request)
    else:
        raise ValueError(f"Unsupported geometry operation: {operation}")

    return result(
        request,
        status="verified",
        primary=points or request.expressions,
        secondary=output,
        reason="SymPy completed the geometry operation.",
    )


def _intersection(request: MathRequest) -> list[sp.Point]:
    """Find intersections from equations or two point-defined lines."""
    x, y = sp.symbols("x y")

    if len(request.expressions) >= 2:
        equations = [parse.equation(value) for value in request.expressions]
        solved = sp.solve(equations, [x, y], dict=True)

        return [sp.Point(solution[x], solution[y]) for solution in solved]

    points = [parse.point(point) for point in request.points]
    _require_points(points, 4)
    equations = [
        _line_equation(points[0], points[1], x, y),
        _line_equation(points[2], points[3], x, y),
    ]
    solved = sp.solve(equations, [x, y], dict=True)

    return [sp.Point(solution[x], solution[y]) for solution in solved]


def _require_points(points: list[sp.Point2D], count: int) -> None:
    """Ensure a geometry operation received enough points."""
    if len(points) < count:
        raise ValueError(f"At least {count} points are required.")


def _slope(start: sp.Point2D, end: sp.Point2D) -> sp.Expr:
    """Compute slope from two points."""
    dy = _difference(end.y, start.y)
    dx = _difference(end.x, start.x)

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
