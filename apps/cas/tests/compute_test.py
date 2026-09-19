import io
import os
import resource
import runpy
import subprocess
import sys
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.index import app
from cas import compute, worker
from cas.schema import MathRequest, MathResult

REQUEST = {"kind": "math", "operation": "evaluate", "expression": "2 + 2"}


def test_compute_runs_owned_worker() -> None:
    result = compute.compute(MathRequest.model_validate(REQUEST))
    assert result.secondary is not None
    assert result.secondary.expression == "4"


@pytest.mark.parametrize(
    "field,value",
    [
        ("expression", "x" * 2049),
        ("values", ["1"] * 129),
        ("matrix", [["1"] * 17]),
        ("matrix", [["1"]] * 17),
        ("order", 101),
    ],
)
def test_input_limits_reject_work_before_compute(field, value) -> None:
    with pytest.raises(ValidationError):
        MathRequest.model_validate({**REQUEST, field: value})


def test_compute_rejects_total_request_size() -> None:
    request = MathRequest.model_validate({**REQUEST, "values": ["1" * 2048] * 128})
    with pytest.raises(ValueError, match="request exceeds"):
        compute.compute(request)


def test_busy_compute_does_not_start_or_wait(monkeypatch) -> None:
    class Busy:
        def acquire(self, *, blocking):
            assert blocking is False
            return False

    monkeypatch.setattr(compute, "_slots", Busy())
    with pytest.raises(compute.ComputeUnavailable, match="busy"):
        compute.compute(MathRequest.model_validate(REQUEST))


@pytest.mark.parametrize("code", [compute.INVALID_INPUT, compute.OVERSIZED_RESULT])
def test_compute_surfaces_bounded_domain_failure(monkeypatch, code) -> None:
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=code, stdout=b"Bound exceeded."
        ),
    )
    with pytest.raises(ValueError, match="Bound exceeded"):
        compute.compute(MathRequest.model_validate(REQUEST))


def test_compute_releases_capacity_after_worker_failure(monkeypatch) -> None:
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout=b""),
    )
    for _ in range(3):
        with pytest.raises(compute.ComputeUnavailable, match="could not complete"):
            compute.compute(MathRequest.model_validate(REQUEST))


def test_compute_reaps_timed_out_process(monkeypatch) -> None:
    original_run = subprocess.run
    expired = []

    def sleeping_worker(*args, **kwargs):
        try:
            return original_run(
                [
                    sys.executable,
                    "-c",
                    "import os,time; print(os.getpid(), flush=True); time.sleep(30)",
                ],
                **{**kwargs, "timeout": 0.2},
            )
        except subprocess.TimeoutExpired as error:
            expired.append(error)
            raise

    monkeypatch.setattr(subprocess, "run", sleeping_worker)
    with pytest.raises(compute.ComputeUnavailable, match="execution budget"):
        compute.compute(MathRequest.model_validate(REQUEST))
    assert len(expired) == 1
    pid = int(expired[0].stdout)
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


def test_http_reports_compute_unavailability(monkeypatch) -> None:
    monkeypatch.setenv("MATH_CAS_API_KEY", "secret")

    def unavailable(*args, **kwargs):
        raise OSError("runtime unavailable")

    monkeypatch.setattr(subprocess, "run", unavailable)
    response = TestClient(app).post(
        "/api/math", headers={"Authorization": "Bearer secret"}, json=REQUEST
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Math service is unavailable."


@pytest.mark.parametrize(
    "source,code,expected",
    [
        (
            b"x" * (compute.MAX_REQUEST_BYTES + 1),
            compute.INVALID_INPUT,
            "request exceeds",
        ),
        (b"{}", compute.INVALID_INPUT, "validation errors"),
    ],
)
def test_worker_bounds_request_and_error(monkeypatch, source, code, expected) -> None:
    output = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
    monkeypatch.setattr(
        sys, "stdin", io.TextIOWrapper(io.BytesIO(source), encoding="utf-8")
    )
    monkeypatch.setattr(sys, "stdout", output)
    assert worker.main() == code
    output.flush()
    assert expected in output.buffer.getvalue().decode()


def test_worker_caps_complete_output(monkeypatch) -> None:
    source = MathRequest.model_validate(REQUEST).model_dump_json().encode()
    output = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
    monkeypatch.setattr(
        sys, "stdin", io.TextIOWrapper(io.BytesIO(source), encoding="utf-8")
    )
    monkeypatch.setattr(sys, "stdout", output)
    monkeypatch.setattr(worker, "MAX_RESPONSE_BYTES", 1)
    assert worker.main() == compute.OVERSIZED_RESULT
    output.flush()
    assert "result exceeds" in output.buffer.getvalue().decode()


def test_worker_entrypoint_emits_valid_result(monkeypatch) -> None:
    # runpy shares the pytest process; only spawned workers set a real limit.
    monkeypatch.setattr(resource, "setrlimit", lambda *_args: None)
    source = MathRequest.model_validate(REQUEST).model_dump_json().encode()
    output = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
    monkeypatch.setattr(
        sys, "stdin", io.TextIOWrapper(io.BytesIO(source), encoding="utf-8")
    )
    monkeypatch.setattr(sys, "stdout", output)
    with pytest.raises(SystemExit) as exited:
        runpy.run_path(worker.__file__, run_name="__main__")
    assert exited.value.code == 0
    result = MathResult.model_validate_json(output.buffer.getvalue())
    assert result.secondary is not None
    assert result.secondary.expression == "4"


@pytest.mark.parametrize(
    "platform,soft,hard,expected",
    [
        ("darwin", resource.RLIM_INFINITY, resource.RLIM_INFINITY, None),
        (
            "linux",
            resource.RLIM_INFINITY,
            resource.RLIM_INFINITY,
            worker.MAX_WORKER_BYTES,
        ),
        (
            "linux",
            worker.MAX_WORKER_BYTES * 2,
            worker.MAX_WORKER_BYTES * 2,
            worker.MAX_WORKER_BYTES,
        ),
        (
            "linux",
            worker.MAX_WORKER_BYTES // 2,
            worker.MAX_WORKER_BYTES,
            worker.MAX_WORKER_BYTES // 2,
        ),
    ],
)
def test_worker_memory_policy_preserves_stricter_host_limits(
    monkeypatch, platform, soft, hard, expected
) -> None:
    calls = []
    monkeypatch.setattr(sys, "platform", platform)
    monkeypatch.setattr(resource, "getrlimit", lambda _resource: (soft, hard))
    monkeypatch.setattr(
        resource, "setrlimit", lambda kind, limits: calls.append((kind, limits))
    )
    worker._limit_memory()
    assert calls == (
        [] if expected is None else [(resource.RLIMIT_AS, (expected, expected))]
    )


def test_worker_fails_closed_if_linux_cannot_install_memory_budget(monkeypatch) -> None:
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr(
        resource,
        "getrlimit",
        lambda _resource: (resource.RLIM_INFINITY, resource.RLIM_INFINITY),
    )

    def unavailable(*_args):
        raise OSError("resource limits unavailable")

    monkeypatch.setattr(resource, "setrlimit", unavailable)
    with pytest.raises(OSError, match="resource limits unavailable"):
        worker._limit_memory()


# Ubuntu CI collects the excessive-allocation case. Never run it on macOS,
# where RLIMIT_AS is not the production Linux memory guarantee.
WORKER_REQUESTS = [
    {"operation": "factor", "expression": "x^4-1"},
    {"operation": "integrate", "expression": "x^2", "variable": "x"},
    {"operation": "determinant", "matrix": [["1", "2"], ["3", "4"]]},
] + ([{"allocation": True}] if sys.platform == "linux" else [])


@pytest.mark.parametrize("case", WORKER_REQUESTS)
def test_isolated_worker_memory_acceptance(case) -> None:
    if "allocation" in case:
        # Prove the OS refuses memory before allocating it, without depending on
        # how fast SymPy evaluates a huge power on a particular CI machine.
        completed = subprocess.run(
            [
                sys.executable,
                "-c",
                "from cas.worker import _limit_memory, MAX_WORKER_BYTES; "
                "_limit_memory(); bytearray(MAX_WORKER_BYTES + 1)",
            ],
            capture_output=True,
            timeout=5,
            check=False,
        )
        assert completed.returncode != 0
        assert b"MemoryError" in completed.stderr
    else:
        payload = MathRequest.model_validate({"kind": "math", **case})
        assert compute.compute(payload).status == "verified"
