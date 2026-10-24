"""Python Worker entry of the CAS engine, deployed by the Nakafa Alchemy stack.

This module holds no logic: the Durable Object forwards each request body to
cas.compute.calculate, which CPython tests. It is not part of the CPython
coverage gate, because the workers SDK exists only inside the Pyodide runtime.
The engine is imported on the first request, not at module import: SymPy seeds a
random generator on import, and a Worker may not draw randomness while it starts.

https://developers.cloudflare.com/durable-objects/get-started/
"""

from workers import DurableObject, Response, WorkerEntrypoint

JSON_HEADERS = {"content-type": "application/json; charset=utf-8"}


class CasSolver(DurableObject):
    """One object that runs one CAS calculation at a time, under platform CPU limits."""

    def __init__(self, ctx, env):
        self.ctx = ctx
        self.env = env

    async def fetch(self, request):
        # Imported here, not at module level: see the module docstring.
        from cas.compute import calculate

        status, body = calculate((await request.text()).encode("utf-8"))
        return Response(body, status=status, headers=JSON_HEADERS)


class Default(WorkerEntrypoint):
    """The engine has no public route, so a direct request answers not found."""

    async def fetch(self, request):
        return Response('{"detail":"Not found."}', status=404, headers=JSON_HEADERS)
