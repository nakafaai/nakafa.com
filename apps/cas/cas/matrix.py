"""Linear algebra CAS operations backed by SymPy."""

import sympy as sp

from cas import parse
from cas.format import item, result
from cas.schema import MathRequest, MathResult


def run(request: MathRequest) -> MathResult:
    """Run exact linear algebra operations on matrix inputs."""
    matrix = parse.matrix(request.matrix)
    operation = request.operation

    if operation == "determinant":
        output = matrix.det()
    elif operation == "inverse":
        output = matrix.inv()
    elif operation == "rank":
        output = matrix.rank()
    elif operation == "rref":
        output = matrix.rref()[0]
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
    elif operation == "linear_system":
        output = sp.linsolve((matrix, parse.vector(request.vector)))
    else:
        raise ValueError(f"Unsupported matrix operation: {operation}")

    return result(
        request,
        status="verified",
        primary=matrix,
        secondary=output,
        reason="SymPy completed the matrix operation.",
    )
