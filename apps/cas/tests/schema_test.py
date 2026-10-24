import re
from pathlib import Path
from typing import get_args

import pytest
from pydantic import ValidationError

from cas.schema import (
    MAX_DERIVATIVE_ORDER,
    MAX_EXPONENT,
    MAX_EXPRESSION_TOKENS,
    MAX_INTEGER_DIGITS,
    MAX_MATRIX_DIMENSION,
    MAX_SERIES_ORDER,
    MathItem,
    MathItemLabel,
    MathRequest,
)

CONTRACT = Path(__file__).parents[3] / "packages" / "math" / "schema" / "shared.ts"
LABELS = re.compile(r"MathItemLabelSchema = Schema\.Literals\(\[(.*?)\]\)", re.DOTALL)


def test_item_labels_are_the_labels_of_the_typescript_contract() -> None:
    declared = LABELS.search(CONTRACT.read_text(encoding="utf-8"))

    assert declared
    assert sorted(re.findall(r'"([a-z0-9_]+)"', declared[1])) == sorted(
        get_args(MathItemLabel)
    )


def test_item_refuses_a_label_that_no_contract_names() -> None:
    with pytest.raises(ValidationError):
        MathItem.model_validate({"label": "result", "value": "1"})


def evaluate(
    expression: str | None = None, values: list[str] | None = None
) -> MathRequest:
    return MathRequest(
        kind="math", operation="evaluate", expression=expression, values=values or []
    )


def tokens(count: int) -> str:
    """Text of exactly `count` tokens: names joined by operators."""
    return "x+" * (count // 2) + ("x" if count % 2 else "")


def test_integer_at_the_digit_bound_is_accepted() -> None:
    expression = "1" * MAX_INTEGER_DIGITS

    assert evaluate(expression=expression).expression == expression


def test_integer_beyond_the_digit_bound_is_refused() -> None:
    with pytest.raises(ValidationError, match=f"at most {MAX_INTEGER_DIGITS} digits"):
        evaluate(expression="1" * (MAX_INTEGER_DIGITS + 1))


def test_exponent_at_the_bound_is_accepted_in_both_spellings() -> None:
    assert evaluate(expression=f"x^{MAX_EXPONENT}").expression
    assert evaluate(expression=f"x**-{MAX_EXPONENT}").expression


def test_exponent_beyond_the_bound_is_refused_in_both_spellings() -> None:
    with pytest.raises(ValidationError, match=f"at most {MAX_EXPONENT}"):
        evaluate(expression=f"x^{MAX_EXPONENT + 1}")
    with pytest.raises(ValidationError, match=f"at most {MAX_EXPONENT}"):
        evaluate(expression=f"x**(-{MAX_EXPONENT + 1})")


def test_expression_at_the_token_bound_is_accepted() -> None:
    expression = tokens(MAX_EXPRESSION_TOKENS)

    assert evaluate(expression=expression).expression == expression


def test_expression_beyond_the_token_bound_is_refused() -> None:
    with pytest.raises(
        ValidationError, match=f"at most {MAX_EXPRESSION_TOKENS} tokens"
    ):
        evaluate(expression=tokens(MAX_EXPRESSION_TOKENS + 1))


def test_every_text_value_of_a_request_is_bounded() -> None:
    with pytest.raises(ValidationError, match="at most 30 digits"):
        evaluate(values=["1" * (MAX_INTEGER_DIGITS + 1)])


def test_matrix_at_the_dimension_bound_is_accepted() -> None:
    square = [["1"] * MAX_MATRIX_DIMENSION] * MAX_MATRIX_DIMENSION
    request = MathRequest(kind="math", operation="determinant", matrix=square)

    assert len(request.matrix) == MAX_MATRIX_DIMENSION


def test_matrix_beyond_the_dimension_bound_is_refused_by_rows_and_columns() -> None:
    row = ["1"] * MAX_MATRIX_DIMENSION
    with pytest.raises(ValidationError):
        MathRequest(
            kind="math",
            operation="determinant",
            matrix=[row] * (MAX_MATRIX_DIMENSION + 1),
        )
    with pytest.raises(ValidationError):
        MathRequest(kind="math", operation="determinant", matrix=[[*row, "1"]])


def test_derivative_order_at_the_bound_is_accepted() -> None:
    request = MathRequest(
        kind="math", operation="differentiate", order=MAX_DERIVATIVE_ORDER
    )

    assert request.order == MAX_DERIVATIVE_ORDER


def test_derivative_order_beyond_the_bound_is_refused() -> None:
    with pytest.raises(ValidationError, match=f"at most {MAX_DERIVATIVE_ORDER}"):
        MathRequest(
            kind="math", operation="differentiate", order=MAX_DERIVATIVE_ORDER + 1
        )


def test_series_order_at_the_bound_is_accepted() -> None:
    request = MathRequest(kind="math", operation="series", order=MAX_SERIES_ORDER)

    assert request.order == MAX_SERIES_ORDER


def test_series_order_beyond_the_bound_is_refused() -> None:
    with pytest.raises(ValidationError, match=f"at most {MAX_SERIES_ORDER}"):
        MathRequest(kind="math", operation="series", order=MAX_SERIES_ORDER + 1)


def test_order_is_unbounded_for_an_operation_that_ignores_it() -> None:
    request = MathRequest(kind="math", operation="evaluate", order=10**9)

    assert request.order == 10**9
