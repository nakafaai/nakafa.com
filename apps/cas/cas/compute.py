"""Bound CPU work independently of client timeouts and concurrent HTTP requests."""

import subprocess
import sys
from threading import BoundedSemaphore

from cas.schema import MathRequest, MathResult

# Responses repeat input as evidence and add LaTeX and steps. The result budget
# allows four times the 64 KiB input budget, below Vercel's 4.5 MB payload limit.
MAX_REQUEST_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 256 * 1024
INVALID_INPUT = 2
OVERSIZED_RESULT = 3

# The math agent allows 30 seconds per model step. Leave ten seconds for network
# and model overhead, and fail busy requests instead of billing a waiting queue.
# Two workers cap concurrent symbolic memory growth in a shared Fluid instance.
COMPUTE_SECONDS = 20
_slots = BoundedSemaphore(2)


class ComputeUnavailable(RuntimeError):
    """A calculation could not finish within the available execution budget."""


def compute(request: MathRequest) -> MathResult:
    """Run only the owned worker and reap it before returning a timeout."""
    source = request.model_dump_json(exclude_none=True).encode("utf-8")
    if len(source) > MAX_REQUEST_BYTES:
        raise ValueError("Math request exceeds the supported size.")
    if not _slots.acquire(blocking=False):
        raise ComputeUnavailable("Math service is busy. Please retry shortly.")

    try:
        # subprocess.run kills and waits for the child on TimeoutExpired.
        # A shared-process signal or a cancelled thread cannot provide that
        # per-request guarantee under Vercel Fluid concurrency.
        # https://docs.python.org/3/library/subprocess.html#subprocess.run
        completed = subprocess.run(
            [sys.executable, "-m", "cas.worker"],
            input=source,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=COMPUTE_SECONDS,
            check=False,
        )
        if completed.returncode in (INVALID_INPUT, OVERSIZED_RESULT):
            raise ValueError(completed.stdout.decode("utf-8"))
        if completed.returncode != 0:
            raise ComputeUnavailable("Math calculation could not complete.")
        return MathResult.model_validate_json(completed.stdout)
    except subprocess.TimeoutExpired as error:
        raise ComputeUnavailable(
            "Math calculation exceeded its execution budget."
        ) from error
    except OSError as error:
        raise ComputeUnavailable("Math service is unavailable.") from error
    finally:
        _slots.release()
