import re
from pathlib import Path
from typing import get_args

import pytest
from pydantic import ValidationError

from cas.schema import MathItem, MathItemLabel

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
