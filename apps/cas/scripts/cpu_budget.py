"""Measure the CPU that each CAS test-corpus request costs, against the Free budget.

The corpus is every request that the test suite sends. A pytest plugin records
each call that the suite makes to `cas.engine.run`, and the literal bodies that
the suite posts to /api/math are read from the sources. Each request runs
through `cas.engine.run`, the calculation that `cas.worker` performs in its
subprocess, and the script records the process CPU time of each call: the first
call of a request is cold, and the later rounds are warm.

Cloudflare Workers on the Free plan allow 10 ms of CPU per request. This script
runs on CPython, not Pyodide, so its numbers estimate the cost of the same code
rather than measure the deployed Worker. Measure the deployed Worker with
Workers Logs (`cpuTime`) before deciding.

Run from apps/cas: `PYTHONPATH=. uv run python scripts/cpu_budget.py --rounds 5`.
"""

import argparse
import ast
import contextlib
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import pytest

from cas import engine
from cas.schema import MathRequest, MathResult

CPU_BUDGET_MS = 10.0
MATH_PATH = "/api/math"
ROOT = Path(__file__).resolve().parent.parent
ORIGINAL_RUN = engine.run


class RecordRuns:
    """A pytest plugin that records each request sent to `cas.engine.run`."""

    def __init__(self) -> None:
        self.requests: list[MathRequest] = []

    def pytest_configure(self, config: pytest.Config) -> None:
        """Replace `run` before the test modules import it by name."""
        engine.run = self._record

    def _record(self, request: MathRequest) -> MathResult:
        self.requests.append(request)
        return ORIGINAL_RUN(request)


@dataclass(frozen=True)
class Summary:
    """The CPU cost of the corpus, in milliseconds per call."""

    requests: int
    cold_max_ms: float
    warm_calls: int
    warm_mean_ms: float
    warm_p50_ms: float
    warm_p95_ms: float
    warm_max_ms: float
    warm_over_budget_calls: int
    budget_ms: float


def record_suite(tests_dir: Path) -> list[MathRequest]:
    """Run the suite once in-process and return the requests it sent to `run`."""
    recorder = RecordRuns()
    # Pytest reports to stderr, so stdout carries only the JSON summary.
    with contextlib.redirect_stdout(sys.stderr):
        exit_code = pytest.main(
            ["-q", "-o", "addopts=", "-p", "no:cacheprovider", str(tests_dir)],
            plugins=[recorder],
        )
    if exit_code != 0:
        raise SystemExit(f"The CAS suite failed with pytest exit code {exit_code}.")
    return recorder.requests


def is_math_post(node: ast.AST) -> bool:
    """Whether a node is a `.post("/api/math", ...)` call."""
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "post"
        and bool(node.args)
        and isinstance(node.args[0], ast.Constant)
        and node.args[0].value == MATH_PATH
    )


def read_api_bodies(tests_dir: Path) -> list[MathRequest]:
    """Return the literal /api/math bodies of the API tests as requests."""
    requests: list[MathRequest] = []
    for path in sorted(tests_dir.glob("*_test.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not is_math_post(node):
                continue
            body = next(
                (keyword.value for keyword in node.keywords if keyword.arg == "json"),
                None,
            )
            if body is None:
                continue
            try:
                requests.append(MathRequest.model_validate(ast.literal_eval(body)))
            except (ValueError, SyntaxError):
                continue
    return requests


def time_requests(
    requests: list[MathRequest], rounds: int
) -> tuple[list[float], list[float]]:
    """Return the cold call and the warm calls of each request, in ms of CPU."""
    cold: list[float] = []
    warm: list[float] = []
    for request in requests:
        for round_number in range(rounds):
            started = time.process_time_ns()
            # Domain validation is part of the corpus; its cost still counts.
            with contextlib.suppress(ValueError):
                ORIGINAL_RUN(request)
            elapsed = (time.process_time_ns() - started) / 1_000_000
            (cold if round_number == 0 else warm).append(elapsed)
    return cold, warm


def percentile(sorted_values: list[float], fraction: float) -> float:
    """The value at a fraction of a sorted, non-empty list."""
    return sorted_values[round(fraction * (len(sorted_values) - 1))]


def summarize(request_count: int, cold: list[float], warm: list[float]) -> Summary:
    """Reduce the timings to the numbers that the Free budget decision needs."""
    ordered = sorted(warm)
    return Summary(
        requests=request_count,
        cold_max_ms=round(max(cold), 3),
        warm_calls=len(ordered),
        warm_mean_ms=round(sum(ordered) / len(ordered), 3),
        warm_p50_ms=round(percentile(ordered, 0.5), 3),
        warm_p95_ms=round(percentile(ordered, 0.95), 3),
        warm_max_ms=round(ordered[-1], 3),
        warm_over_budget_calls=sum(1 for value in ordered if value > CPU_BUDGET_MS),
        budget_ms=CPU_BUDGET_MS,
    )


def main() -> None:
    """Print the corpus CPU summary as JSON."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--rounds", type=int, default=5)
    arguments = parser.parse_args()

    tests_dir = ROOT / "tests"
    requests = record_suite(tests_dir) + read_api_bodies(tests_dir)
    cold, warm = time_requests(requests, arguments.rounds)
    print(json.dumps(asdict(summarize(len(requests), cold, warm)), indent=2))


if __name__ == "__main__":
    main()
