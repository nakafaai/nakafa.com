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
        _require_square(matrix, "Eigenvalues")
        # SymPy documents `multiple=True` as the list output form for eigenvals.
        # https://docs.sympy.org/latest/modules/matrices/matrices.html#sympy.matrices.matrixbase.MatrixBase.eigenvals
        eigenvalues = matrix.eigenvals(multiple=True)
        return result(
            request,
            status="verified",
            primary=matrix,
            reason="Eigenvalues were checked exactly.",
            items=[item("eigenvalue", value) for value in eigenvalues],
        )
    elif operation == "eigen_analysis":
        _require_square(matrix, "Eigen analysis")
        return _eigen_analysis(request, matrix)
    elif operation == "eigenvectors":
        _require_square(matrix, "Eigenvectors")
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
        vector = parse.vector(request.vector)
        _require_linear_system_dimensions(matrix, vector)
        # `linsolve((matrix, vector))` is SymPy's exact linear-system API for
        # augmented matrix data.
        # https://docs.sympy.org/latest/modules/solvers/solveset.html#sympy.solvers.solveset.linsolve
        output = sp.linsolve((matrix, vector))
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


def _require_linear_system_dimensions(matrix: sp.Matrix, vector: sp.Matrix) -> None:
    """Ensure a linear system has one vector value per matrix row."""
    if matrix.rows != vector.rows:
        raise ValueError("Linear system vector length must match matrix rows.")


def _eigen_analysis(request: MathRequest, matrix: sp.Matrix) -> MathResult:
    """Check eigenvalues, eigenspaces, multiplicities, and diagonalizability."""
    analysis_items = []
    total_geometric_multiplicity = 0

    for eigenvalue, algebraic_multiplicity, eigenvectors in matrix.eigenvects():
        geometric_multiplicity = len(eigenvectors)
        total_geometric_multiplicity += geometric_multiplicity
        analysis_items.extend(
            [
                item("eigenvalue", eigenvalue),
                item(
                    "algebraic_multiplicity",
                    _eigenvalue_item(eigenvalue, algebraic_multiplicity),
                ),
                item(
                    "geometric_multiplicity",
                    _eigenvalue_item(eigenvalue, geometric_multiplicity),
                ),
                item("eigenbasis", _eigenbasis_item(eigenvalue, eigenvectors)),
            ]
        )

    diagonalizable = total_geometric_multiplicity == matrix.rows
    diagonalizable_value = str(diagonalizable).lower()

    return result(
        request,
        status="verified",
        primary=matrix,
        reason=(
            "Eigenvalues, algebraic multiplicities, eigenspace bases, "
            "geometric multiplicities, and diagonalizability were checked exactly."
        ),
        items=[
            *analysis_items,
            item(
                "diagonalizable",
                expression_text(
                    diagonalizable_value,
                    rf"\operatorname{{{diagonalizable_value}}}",
                ),
            ),
        ],
    )


def _eigenvalue_item(eigenvalue: object, value: object) -> object:
    """Render one eigenvalue-scoped scalar item."""
    return expression_text(
        f"lambda = {eigenvalue}: {value}",
        rf"\lambda = {sp.latex(eigenvalue)}:\;{sp.latex(value)}",
    )


def _eigenbasis_item(eigenvalue: object, eigenvectors: list[sp.Matrix]) -> object:
    """Render one eigenvalue-scoped eigenspace basis."""
    vector_text = ", ".join(str(vector) for vector in eigenvectors)
    vector_latex = ", ".join(sp.latex(vector) for vector in eigenvectors)

    return expression_text(
        f"lambda = {eigenvalue}: span({vector_text})",
        (
            rf"\lambda = {sp.latex(eigenvalue)}:\;"
            rf"\operatorname{{span}}\left\{{{vector_latex}\right\}}"
        ),
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
