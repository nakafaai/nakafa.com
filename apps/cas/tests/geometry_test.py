import pytest

from cas import geometry
from cas.engine import run
from cas.schema import MathRequest, PointInput


def test_geometry_point_operations() -> None:
    points = [PointInput(x="0", y="0"), PointInput(x="3", y="4")]
    distance = run(MathRequest(kind="math", operation="distance", points=points))
    midpoint = run(MathRequest(kind="math", operation="midpoint", points=points))
    slope = run(MathRequest(kind="math", operation="slope", points=points))
    line = run(MathRequest(kind="math", operation="line", points=points))
    circle = run(MathRequest(kind="math", operation="circle", points=points))

    assert distance.secondary
    assert distance.secondary.expression == "5"
    assert midpoint.secondary
    assert midpoint.secondary.expression == "(3/2, 2)"
    assert slope.secondary
    assert slope.secondary.expression == "4/3"
    assert line.secondary
    assert line.secondary.expression == "4*x - 3*y"
    assert circle.secondary
    assert circle.secondary.expression == "x**2 + y**2 - 25"


def test_geometry_intersections() -> None:
    equations = run(
        MathRequest(
            expressions=["x + y = 3", "x - y = 1"],
            kind="math",
            operation="intersection",
        )
    )
    points = run(
        MathRequest(
            kind="math",
            operation="intersection",
            points=[
                PointInput(x="0", y="0"),
                PointInput(x="1", y="1"),
                PointInput(x="0", y="1"),
                PointInput(x="1", y="0"),
            ],
        )
    )

    assert equations.secondary
    assert equations.secondary.expression == "(2, 1)"
    assert points.secondary
    assert points.secondary.expression == "(1/2, 1/2)"


def test_geometry_empty_intersection_is_display_safe() -> None:
    result = run(
        MathRequest(
            expressions=["x + y = 1", "x + y = 2"],
            kind="math",
            operation="intersection",
        )
    )

    assert result.secondary
    assert result.secondary.expression == "empty set"
    assert result.secondary.latex == "\\varnothing"


def test_geometry_requires_enough_points() -> None:
    with pytest.raises(ValueError, match="At least 2 points are required"):
        run(
            MathRequest(
                kind="math",
                operation="distance",
                points=[PointInput(x="0", y="0")],
            )
        )


def test_unknown_geometry_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported geometry operation"):
        geometry.run(MathRequest(kind="math", operation="unknown"))
