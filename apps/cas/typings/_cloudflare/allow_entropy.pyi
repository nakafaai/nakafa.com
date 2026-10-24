"""Declarations of the runtime module that a Python Worker provides.

The module exists only inside the Workers Python runtime, so the CPython toolchain
checks the Worker entry against this declaration.
"""

from contextlib import AbstractContextManager

def allow_bad_entropy_calls(n: int) -> AbstractContextManager[None]: ...
