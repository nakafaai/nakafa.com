"""Python Worker entry of the CAS engine, deployed by the Nakafa Alchemy stack.

This module holds no logic: the Durable Object forwards each request body to
cas.compute.calculate, which CPython tests. It is not part of the CPython
coverage gate, because the workers SDK and the runtime's entropy module exist
only inside the Pyodide runtime.

SymPy is imported at module level, inside the runtime's entropy allowance, so the
import lands in the deploy-time memory snapshot and no request pays for it. A
Worker may not draw randomness while it starts, so the allowance covers exactly
the calls that the import makes.

https://developers.cloudflare.com/durable-objects/get-started/
"""

from _cloudflare.allow_entropy import allow_bad_entropy_calls
from workers import DurableObject, Response, WorkerEntrypoint

# SymPy seeds three unseeded random generators when it is imported: two in
# sympy.core.random and one in sympy.core.symbol. Each generator reads 2,496 bytes,
# which Pyodide 0.28.3 requests from getentropy in 256-byte chunks, so the import
# makes 3 x 10 = 30 calls. The runtime fails the import when the count is short or
# over. Measured with SymPy 1.14.0 and mpmath 1.3.0, the versions the engine vendors.
SYMPY_IMPORT_ENTROPY_CALLS = 30

JSON_HEADERS = {"content-type": "application/json; charset=utf-8"}

with allow_bad_entropy_calls(SYMPY_IMPORT_ENTROPY_CALLS):
    from cas.compute import calculate


class CasSolver(DurableObject):
    """One object that runs one CAS calculation at a time, under platform CPU limits."""

    def __init__(self, ctx, env):
        self.ctx = ctx
        self.env = env

    async def fetch(self, request):
        status, body = calculate(await request.bytes())
        return Response(body, status=status, headers=JSON_HEADERS)


class Default(WorkerEntrypoint):
    """The engine has no public route, so a direct request answers not found."""

    async def fetch(self, request):
        return Response('{"detail":"Not found."}', status=404, headers=JSON_HEADERS)
