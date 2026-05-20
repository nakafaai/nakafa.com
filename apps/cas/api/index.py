"""FastAPI routes for the deterministic Nakafa CAS service."""

from datetime import UTC, datetime

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from cas.auth import require_api_key
from cas.engine import run
from cas.schema import MathRequest, MathResult

load_dotenv(".env.local", override=False)

app = FastAPI(title="Nakafa CAS")


@app.get("/")
def root() -> PlainTextResponse:
    """Return an informational terminal-style root response."""
    timestamp = datetime.now(UTC).strftime("%H:%M:%S")
    terminal_output = f"""Nakafa CAS Server

[{timestamp}] INFO: Welcome to Nakafa CAS Server.
[{timestamp}] INFO: Deterministic computer algebra for Nakafa math workflows.

[{timestamp}] INFO: CAS Server initialized successfully.
[{timestamp}] INFO: Root URL https://cas.nakafa.com is informational only.
[{timestamp}] INFO: Use POST /api/math as the private CAS compute endpoint.
[{timestamp}] INFO: Health check: https://cas.nakafa.com/health

[{timestamp}] INFO: Website: https://nakafa.com
[{timestamp}] INFO: GitHub: https://github.com/nakafaai/nakafa.com
[{timestamp}] INFO: Documentation: https://docs.nakafa.com

nakafa-cas-server:~$ _
"""

    return PlainTextResponse(terminal_output)


@app.get("/health")
def health() -> dict[str, str]:
    """Return a readiness response for deployment health checks."""
    return {"status": "ok"}


@app.exception_handler(ValueError)
def value_error_handler(_request: Request, error: ValueError) -> JSONResponse:
    """Convert deterministic CAS validation failures into HTTP 422 responses."""
    # FastAPI exception handlers let CAS validation errors stay typed at the API
    # boundary instead of leaking stack traces.
    # https://fastapi.tiangolo.com/tutorial/handling-errors/#install-custom-exception-handlers
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.post(
    "/api/math",
    dependencies=[Depends(require_api_key)],
    response_model=MathResult,
    response_model_exclude_none=True,
)
def math(request: MathRequest) -> MathResult:
    """Run one fixed CAS operation after bearer-token authentication."""
    return run(request)
