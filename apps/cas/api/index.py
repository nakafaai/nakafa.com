"""FastAPI routes for the deterministic Nakafa CAS service."""

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from cas.auth import require_api_key
from cas.engine import run
from cas.schema import MathRequest, MathResult

load_dotenv(".env.local", override=False)

app = FastAPI(title="Nakafa CAS")


@app.get("/health")
def health() -> dict[str, str]:
    """Return a readiness response for deployment health checks."""
    return {"status": "ok"}


@app.exception_handler(ValueError)
def value_error_handler(_request: Request, error: ValueError) -> JSONResponse:
    """Convert deterministic CAS validation failures into HTTP 422 responses."""
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.post("/api/math", dependencies=[Depends(require_api_key)])
def math(request: MathRequest) -> MathResult:
    """Run one fixed CAS operation after bearer-token authentication."""
    return run(request)
