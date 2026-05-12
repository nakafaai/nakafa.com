"""Linear algebra CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import expression_text, item, result, step
from cas.schema import MathRequest, MathResult

EQUALS = expression_text("equals", "=")


def run(request: MathRequest) -> MathResult:
    """Run exact linear algebra operations on matrix inputs."""
    matrix = parse.matrix(request.matrix)
    operation = request.operation

    if operation == "determinant":
        _require_square(matrix, "Determinant")
        output = matrix.det()
        steps = _determinant_steps(matrix, output)
    elif operation == "inverse":
        _require_square(matrix, "Inverse")
        _require_invertible(matrix)
        output = matrix.inv()
        steps = []
    elif operation == "rank":
        output = matrix.rank()
        steps = []
    elif operation == "rref":
        output = matrix.rref()[0]
        steps = []
    elif operation == "eigenvalues":
        eigenvalues = matrix.eigenvals(multiple=True)
        return result(
            request,
            status="verified",
            primary=matrix,
            reason="Eigenvalues were checked exactly.",
            items=[item("eigenvalue", value) for value in eigenvalues],
        )
    elif operation == "eigenvectors":
        return result(
            request,
            status="verified",
            primary=matrix,
            reason="Eigenvectors were checked exactly.",
            items=[item("eigenvector", vector) for vector in matrix.eigenvects()],
        )
    elif operation == "matrix_multiply":
        right_matrix = parse.matrix(request.right_matrix)
        _require_multipliable(matrix, right_matrix)
        output = matrix * right_matrix
        steps = []
    elif operation == "linear_system":
        output = sp.linsolve((matrix, parse.vector(request.vector)))
        steps = []
    else:
        raise ValueError(f"Unsupported matrix operation: {operation}")

    return result(
        request,
        status="verified",
        primary=matrix,
        secondary=output,
        reason="The matrix operation was checked exactly.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


def _require_square(matrix: sp.Matrix, name: str) -> None:
    """Ensure an operation receives a square matrix."""
    if matrix.rows != matrix.cols:
        raise ValueError(f"{name} requires a square matrix.")


def _require_invertible(matrix: sp.Matrix) -> None:
    """Ensure an inverse request receives a nonsingular matrix."""
    if matrix.det() == 0:
        raise ValueError("Inverse requires a nonsingular matrix.")


def _require_multipliable(left: sp.Matrix, right: sp.Matrix) -> None:
    """Ensure matrix multiplication dimensions are compatible."""
    if left.cols != right.rows:
        raise ValueError("Matrix multiplication requires matching inner dimensions.")


def _determinant_steps(matrix: sp.Matrix, output: object) -> list:
    """Create the 2-by-2 determinant formula step when it is readable."""
    if matrix.shape != (2, 2):
        return []

    a, b, c, d = matrix[0, 0], matrix[0, 1], matrix[1, 0], matrix[1, 1]
    formula = expression_text(
        f"{a}*{d} - {b}*{c}",
        f"{sp.latex(a)} \\cdot {sp.latex(d)} - {sp.latex(b)} \\cdot {sp.latex(c)}",
    )

    return [step("determinant", primary=formula, relation=EQUALS, secondary=output)]
