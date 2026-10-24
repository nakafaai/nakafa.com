"""One bounded CAS calculation, answered as a status and a JSON body.

The Durable Object in entry.py calls this function and nothing else, so every
rule about input and output size lives here, where CPython can test it.
"""

import json

from cas.engine import run
from cas.schema import MathRequest

# Responses repeat input as evidence and add LaTeX and steps. The result budget
# allows four times the 64 KiB input budget.
MAX_REQUEST_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 256 * 1024
OK = 200
INVALID_INPUT = 422
DETAIL_CHARACTERS = 2048


def calculate(source: bytes) -> tuple[int, str]:
    """Run one fixed CAS operation and return its HTTP status and JSON body."""
    if len(source) > MAX_REQUEST_BYTES:
        return INVALID_INPUT, _detail("Math request exceeds the supported size.")

    try:
        request = MathRequest.model_validate_json(source)
        output = run(request).model_dump_json(exclude_none=True)
    except ValueError as error:
        # Domain messages are actionable for the learner, so they are kept and
        # bounded. Pydantic validation errors are ValueError too.
        return INVALID_INPUT, _detail(str(error)[:DETAIL_CHARACTERS])

    if len(output.encode("utf-8")) > MAX_RESPONSE_BYTES:
        return INVALID_INPUT, _detail("Math result exceeds the supported size.")
    return OK, output


def _detail(message: str) -> str:
    """The error body shape that the TypeScript math client already reads."""
    return json.dumps({"detail": message})
