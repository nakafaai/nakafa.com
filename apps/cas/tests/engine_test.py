from cas.engine import run
from cas.schema import MathRequest


def test_engine_returns_inconclusive_for_unknown_operation() -> None:
    result = run(MathRequest(kind="math", operation="unknown"))

    assert result.status == "inconclusive"
