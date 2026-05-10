import pytest

from cas import matrix
from cas.engine import run
from cas.schema import MathRequest


def test_matrix_determinant() -> None:
    result = run(
        MathRequest(
            kind="math",
            matrix=[["1", "2"], ["3", "4"]],
            operation="determinant",
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "-2"


def test_matrix_multiply() -> None:
    result = run(
        MathRequest(
            kind="math",
            matrix=[["1", "2"]],
            operation="matrix_multiply",
            right_matrix=[["3"], ["4"]],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "Matrix([[11]])"


def test_matrix_inverse_rank_rref_and_eigen_data() -> None:
    inverse = run(
        MathRequest(
            kind="math",
            matrix=[["1", "2"], ["3", "4"]],
            operation="inverse",
        )
    )
    rank = run(
        MathRequest(
            kind="math",
            matrix=[["1", "2"], ["2", "4"]],
            operation="rank",
        )
    )
    rref = run(
        MathRequest(
            kind="math",
            matrix=[["1", "2"], ["2", "4"]],
            operation="rref",
        )
    )
    eigenvalues = run(
        MathRequest(
            kind="math",
            matrix=[["2", "0"], ["0", "3"]],
            operation="eigenvalues",
        )
    )
    eigenvectors = run(
        MathRequest(
            kind="math",
            matrix=[["2", "0"], ["0", "3"]],
            operation="eigenvectors",
        )
    )

    assert inverse.secondary
    assert inverse.secondary.expression == "Matrix([[-2, 1], [3/2, -1/2]])"
    assert rank.secondary
    assert rank.secondary.expression == "1"
    assert rref.secondary
    assert rref.secondary.expression == "Matrix([[1, 2], [0, 0]])"
    assert eigenvalues.items
    assert eigenvectors.items


def test_linear_system() -> None:
    result = run(
        MathRequest(
            kind="math",
            matrix=[["1", "1"], ["1", "-1"]],
            operation="linear_system",
            vector=["3", "1"],
        )
    )

    assert result.status == "verified"
    assert result.secondary
    assert result.secondary.expression == "{(2, 1)}"


def test_unknown_matrix_operation_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported matrix operation"):
        matrix.run(
            MathRequest(
                kind="math",
                matrix=[["1"]],
                operation="unknown",
            )
        )
