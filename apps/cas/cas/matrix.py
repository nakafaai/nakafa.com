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
        output = matrix.det()
        steps = _determinant_steps(matrix, output)
    elif operation == "inverse":
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
            reason="SymPy computed eigenvalues.",
            items=[item("eigenvalue", value) for value in eigenvalues],
        )
    elif operation == "eigenvectors":
        return result(
            request,
            status="verified",
            primary=matrix,
            reason="SymPy computed eigenvectors.",
            items=[item("eigenvector", vector) for vector in matrix.eigenvects()],
        )
    elif operation == "matrix_multiply":
        output = matrix * parse.matrix(request.right_matrix)
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
        reason="SymPy completed the matrix operation.",
        steps=steps,
        stepStatus="complete" if steps else "unavailable",
    )


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
