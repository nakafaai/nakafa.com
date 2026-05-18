"""Authentication guard for the private Nakafa CAS API."""

from os import environ

from fastapi import Header, HTTPException


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    """Require the configured bearer token before running CAS operations."""
    expected = environ.get("MATH_CAS_API_KEY")

    if not expected:
        raise HTTPException(status_code=500, detail="MATH_CAS_API_KEY is not set.")

    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid CAS API key.")
