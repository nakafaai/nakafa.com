"""Authentication guard for the private Nakafa CAS API."""

import logging
from os import environ

from fastapi import Header, HTTPException

logger = logging.getLogger("nakafa.cas.auth")


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    """Require the configured bearer token before running CAS operations."""
    expected = environ.get("MATH_CAS_API_KEY")

    if not expected:
        logger.error("CAS auth rejected because MATH_CAS_API_KEY is not configured.")
        raise HTTPException(status_code=500, detail="MATH_CAS_API_KEY is not set.")

    if authorization is None:
        logger.warning("CAS auth rejected because Authorization header is missing.")
        raise HTTPException(status_code=401, detail="Invalid CAS API key.")

    if authorization != f"Bearer {expected}":
        logger.warning("CAS auth rejected because bearer token does not match.")
        raise HTTPException(status_code=401, detail="Invalid CAS API key.")
