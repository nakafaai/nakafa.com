"""One isolated CAS calculation, including bounded response serialization."""

import resource
import sys

from cas.compute import (
    INVALID_INPUT,
    MAX_REQUEST_BYTES,
    MAX_RESPONSE_BYTES,
    OVERSIZED_RESULT,
)
from cas.engine import run
from cas.schema import MathRequest

# The production project uses Vercel's standard 2 GiB Fluid instance. Two
# 512 MiB workers leave at least 1 GiB for FastAPI and platform overhead.
# RLIMIT_AS bounds intermediate allocations, before serialized output exists.
# https://docs.python.org/3/library/resource.html#resource.RLIMIT_AS
MAX_WORKER_BYTES = 512 * 1024 * 1024


def _limit_memory() -> None:
    """Apply the Linux production budget only inside the isolated worker."""
    if sys.platform != "linux":
        return
    soft, hard = resource.getrlimit(resource.RLIMIT_AS)
    budget = min(
        limit
        for limit in (MAX_WORKER_BYTES, soft, hard)
        if limit != resource.RLIM_INFINITY
    )
    resource.setrlimit(resource.RLIMIT_AS, (budget, budget))


def main() -> int:
    """Read bounded JSON and emit either a complete result or a small error."""
    source = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(source) > MAX_REQUEST_BYTES:
        sys.stdout.write("Math request exceeds the supported size.")
        return INVALID_INPUT

    try:
        request = MathRequest.model_validate_json(source)
        result = run(request)
        output = result.model_dump_json(exclude_none=True).encode("utf-8")
    except ValueError as error:
        # Preserve actionable domain validation while bounding the text emitted
        # by the worker, including validation of its standalone JSON input.
        sys.stdout.write(str(error)[:2048])
        return INVALID_INPUT

    if len(output) > MAX_RESPONSE_BYTES:
        sys.stdout.write("Math result exceeds the supported size.")
        return OVERSIZED_RESULT

    sys.stdout.buffer.write(output)
    return 0


if __name__ == "__main__":
    _limit_memory()
    raise SystemExit(main())
