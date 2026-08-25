import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/backend/agent/mcp/identity";
import { NAKAFA_MCP_REGISTRY_MANIFEST } from "@repo/backend/agent/mcp/manifest";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { limitAgentRequest } from "@repo/backend/convex/routes/agent/rateLimit";
import {
  hasTrustedMcpOrigin,
  hasValidEdgeSecret,
  readTrustedMcpOrigins,
} from "@repo/backend/convex/routes/agent/security";
import { requestId } from "@repo/backend/convex/routes/middleware/requestId";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Option } from "effect";
import { Hono } from "hono";

type AgentHono = Hono<{
  Bindings: ActionCtx;
  Variables: { requestId: string };
}>;

const MCP_HEADERS = {
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, Retry-After",
  "Cache-Control": "no-store",
  Vary: "Accept, Accept-Encoding, Origin",
};
const mcp: AgentHono = new Hono();

/** Handles the canonical MCP transport and its Registry manifest. */
mcp.use("*", requestId);
mcp.use("*", async (c, next) => {
  const request = c.req.raw;
  const requestId = c.get("requestId");
  const guard = await readMcpGuard(request);
  if (guard === "unavailable") {
    return mcpErrorResponse(
      503,
      -32_603,
      "The MCP edge authentication boundary is unavailable.",
      requestId
    );
  }
  if (guard === "forbidden") {
    return mcpErrorResponse(
      403,
      -32_003,
      "Direct access to this Convex MCP origin is not allowed.",
      requestId
    );
  }
  if (guard === "invalid-origin") {
    return mcpErrorResponse(
      403,
      -32_003,
      "The browser Origin is not trusted by this MCP server.",
      requestId
    );
  }

  await next();
});

mcp.get("/health", (c) => {
  const request = c.req.raw;
  return new Response(
    JSON.stringify({
      server: {
        name: NAKAFA_MCP_SERVER_NAME,
        version: NAKAFA_MCP_SERVER_VERSION,
      },
      status: "healthy",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        ...withCorsHeaders(request),
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
});

mcp.all("/", async (c) => {
  const request = c.req.raw;
  const requestId = c.get("requestId");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: withCorsHeaders(request),
      status: 204,
    });
  }
  if (request.method === "GET") {
    return new Response(JSON.stringify(NAKAFA_MCP_REGISTRY_MANIFEST), {
      headers: {
        ...withCorsHeaders(request),
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
  if (request.method !== "POST") {
    return mcpErrorResponse(
      405,
      -32_600,
      "The Nakafa MCP endpoint supports GET, POST, and OPTIONS only.",
      requestId
    );
  }

  const requestedProtocol = request.headers.get("mcp-protocol-version");
  if (requestedProtocol === null) {
    const responseId = await readJsonRpcRequestId(request);
    return mcpErrorResponse(
      400,
      -32_020,
      "The MCP-Protocol-Version header is required for modern requests.",
      requestId,
      responseId
    );
  }
  if (requestedProtocol !== NAKAFA_MCP_PROTOCOL_VERSION) {
    const responseId = await readJsonRpcRequestId(request);
    return mcpErrorResponse(
      400,
      -32_020,
      `The Nakafa MCP server supports protocol ${NAKAFA_MCP_PROTOCOL_VERSION} only.`,
      requestId,
      responseId
    );
  }

  const rateLimit = await Effect.runPromise(
    limitAgentRequest(c.env, request, "mcp").pipe(
      Effect.match({
        onFailure: () => null,
        onSuccess: (decision) => decision,
      })
    )
  );
  if (rateLimit === null) {
    return mcpErrorResponse(
      503,
      -32_603,
      "The public MCP request limiter is unavailable.",
      requestId
    );
  }
  if (!rateLimit.allowed) {
    const responseId = await readJsonRpcRequestId(request);
    return mcpErrorResponse(
      429,
      -32_029,
      "The public MCP request limit was exceeded for this client.",
      requestId,
      responseId,
      rateLimit.retryAfterMilliseconds
    );
  }

  const runtime = await Effect.runPromise(loadMcpRuntime().pipe(Effect.option));
  if (Option.isNone(runtime)) {
    return mcpErrorResponse(
      503,
      -32_603,
      "The MCP protocol runtime is unavailable.",
      requestId
    );
  }

  const handler = runtime.value.sdk.createMcpHandler(
    () => runtime.value.server.createNakafaMcpServer(c.env),
    { legacy: "reject" }
  );
  const response = await handler.fetch(request);
  return withResponseHeaders(response, request);
});

/** Registers the canonical MCP transport and its Registry manifest. */
export function registerAgentMcpRoutes(app: HonoWithConvex<ActionCtx>) {
  app.route("/mcp", mcp);
}

/** Loads the MCP-only runtime after the manifest and edge checks have passed. */
const loadMcpRuntime = Effect.fn("agent.mcp.loadRuntime")(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(cause),
        message: "Unable to load the MCP protocol runtime.",
      }),
    try: () =>
      Promise.all([
        import("@modelcontextprotocol/server"),
        import("@repo/backend/agent/mcp/server"),
      ]).then(([sdk, server]) => ({ sdk, server })),
  })
);

/** Validates the edge secret and exact optional browser origin. */
async function readMcpGuard(request: Request) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const validSecret = yield* hasValidEdgeSecret(
        request,
        NAKAFA_MCP_EDGE_CONTRACT
      );
      if (!validSecret) {
        return "forbidden" as const;
      }
      const origins = yield* readTrustedMcpOrigins();
      return hasTrustedMcpOrigin(request, origins)
        ? ("allowed" as const)
        : ("invalid-origin" as const);
    }).pipe(
      Effect.match({
        onFailure: () => "unavailable" as const,
        onSuccess: (result) => result,
      })
    )
  );
}

/** Returns a JSON-RPC error while preserving the HTTP denial status. */
function mcpErrorResponse(
  status: number,
  code: number,
  message: string,
  requestId: string,
  responseId: number | string | null = null,
  retryAfterMilliseconds?: number
) {
  const retryAfter =
    retryAfterMilliseconds === undefined
      ? undefined
      : Math.max(1, Math.ceil(retryAfterMilliseconds / 1000));
  return new Response(
    JSON.stringify({
      error: {
        code,
        data: {
          request_id: requestId,
          ...(retryAfterMilliseconds === undefined
            ? {}
            : { retry_after_ms: retryAfterMilliseconds }),
        },
        message,
      },
      id: responseId,
      jsonrpc: "2.0",
    }),
    {
      headers: {
        ...MCP_HEADERS,
        "Access-Control-Allow-Origin": "*",
        ...(status === 405 ? { Allow: "GET, POST, OPTIONS" } : {}),
        "Content-Type": "application/json; charset=utf-8",
        "MCP-Protocol-Version": NAKAFA_MCP_PROTOCOL_VERSION,
        ...(retryAfter === undefined
          ? {}
          : { "Retry-After": String(retryAfter) }),
      },
      status,
    }
  );
}

/** Recovers an echoable JSON-RPC request ID for an HTTP-level rejection. */
function readJsonRpcRequestId(request: Request) {
  return Effect.runPromise(
    Effect.tryPromise({
      catch: () => null,
      try: async () => {
        const body: unknown = await request.clone().json();
        return body;
      },
    }).pipe(
      Effect.map((body) => {
        if (typeof body !== "object" || body === null || !("id" in body)) {
          return null;
        }
        const id = body.id;
        return typeof id === "string" || typeof id === "number" ? id : null;
      })
    )
  );
}

/** Adds protocol and CORS metadata without discarding SDK response headers. */
function withResponseHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(withCorsHeaders(request))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** Emits a wildcard for server clients and echoes a validated browser origin. */
function withCorsHeaders(
  request: Request,
  protocolVersion = NAKAFA_MCP_PROTOCOL_VERSION
) {
  return {
    ...MCP_HEADERS,
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "MCP-Protocol-Version": protocolVersion,
  };
}
