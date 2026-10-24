import json

import pytest

from cas import compute
from cas.schema import MathRequest

REQUEST = {"kind": "math", "operation": "evaluate", "expression": "2 + 2"}


def body_of(source: dict) -> bytes:
    return json.dumps(source).encode("utf-8")


def test_calculate_returns_verified_result_as_json() -> None:
    status, body = compute.calculate(body_of(REQUEST))

    payload = json.loads(body)
    assert status == compute.OK
    assert payload["status"] == "verified"
    assert payload["secondary"]["expression"] == "4"
    assert "distribution" not in payload["input"]


def test_calculate_refuses_request_over_the_size_budget() -> None:
    source = b"x" * (compute.MAX_REQUEST_BYTES + 1)

    assert compute.calculate(source) == (
        compute.INVALID_INPUT,
        json.dumps({"detail": "Math request exceeds the supported size."}),
    )


def test_calculate_reports_validation_error_as_invalid_input() -> None:
    status, body = compute.calculate(body_of({"kind": "math", "operation": "evaluate"}))

    assert status == compute.INVALID_INPUT
    assert json.loads(body) == {"detail": "Expression is required."}


def test_calculate_rejects_malformed_json_as_invalid_input() -> None:
    status, body = compute.calculate(b"{not json")

    assert status == compute.INVALID_INPUT
    assert "detail" in json.loads(body)


def test_calculate_bounds_a_domain_message(monkeypatch) -> None:
    def refuse(_request: MathRequest) -> None:
        raise ValueError("x" * 5000)

    monkeypatch.setattr(compute, "run", refuse)
    status, body = compute.calculate(body_of(REQUEST))

    assert status == compute.INVALID_INPUT
    assert json.loads(body)["detail"] == "x" * compute.DETAIL_CHARACTERS


def test_calculate_refuses_a_bound_breach_before_sympy_runs(monkeypatch) -> None:
    def fail_if_run(_request: MathRequest) -> None:
        raise AssertionError("SymPy ran for a request beyond a complexity bound")

    monkeypatch.setattr(compute, "run", fail_if_run)
    source = body_of({"kind": "math", "operation": "evaluate", "expression": "x^71"})

    status, body = compute.calculate(source)

    assert status == compute.INVALID_INPUT
    assert "Exponents may be at most 70." in json.loads(body)["detail"]


def test_calculate_refuses_result_over_the_response_budget(monkeypatch) -> None:
    monkeypatch.setattr(compute, "MAX_RESPONSE_BYTES", 1)

    assert compute.calculate(body_of(REQUEST)) == (
        compute.INVALID_INPUT,
        json.dumps({"detail": "Math result exceeds the supported size."}),
    )


def test_calculate_propagates_unexpected_failures(monkeypatch) -> None:
    def fail(_request: MathRequest) -> None:
        raise RuntimeError("engine failure")

    monkeypatch.setattr(compute, "run", fail)

    with pytest.raises(RuntimeError, match="engine failure"):
        compute.calculate(body_of(REQUEST))


def test_calculate_bounds_the_canonical_request_not_the_raw_body() -> None:
    # Omitted list fields take their defaults in the canonical form, so this
    # compact body fits the limit as sent but not once validated.
    values = ["x" * 2048] * 31 + ["x" * 1810]
    source = json.dumps(
        {"kind": "math", "operation": "evaluate", "values": values},
        separators=(",", ":"),
    ).encode("utf-8")
    canonical = (
        MathRequest.model_validate_json(source)
        .model_dump_json(exclude_none=True)
        .encode("utf-8")
    )
    assert len(source) <= compute.MAX_REQUEST_BYTES < len(canonical)

    assert compute.calculate(source) == (
        compute.INVALID_INPUT,
        json.dumps({"detail": "Math request exceeds the supported size."}),
    )
