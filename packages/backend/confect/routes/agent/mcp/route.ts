import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { enforceAgentReadLimit } from "@repo/backend/confect/routes/agent/limit";
import { guardMcpOrigin } from "@repo/backend/confect/routes/agent/mcp/guard";
import { readMcpRequest } from "@repo/backend/confect/routes/agent/mcp/input";
import {
  mcpOptionsResponse,
  mcpParsedErrorResponse,
  mcpTransportErrorResponse,
  withMcpResponseHeaders,
} from "@repo/backend/confect/routes/agent/mcp/response";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/agent/errors";
import { Effect, Layer, Result } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

/** Serves the protected Streamable HTTP MCP transport in native Effect. */
const handleMcp = Effect.gen(function* () {
  const runtimeServices = yield* Effect.context<never>();
  const request = yield* HttpServerRequest.toWeb(
    yield* HttpServerRequest.HttpServerRequest
  );
  const requestId = yield* RequestIdentity;
  if (request.method === "OPTIONS") {
    return mcpOptionsResponse(request);
  }
  const limited = yield* enforceAgentReadLimit(request).pipe(
    Effect.match({
      onFailure: (error) =>
        error._tag === "AgentRateLimitError"
          ? {
              kind: "limited" as const,
              retryAfterMs: error.retryAfterMs,
            }
          : {
              kind: "unavailable" as const,
            },
      onSuccess: () => ({
        kind: "allowed" as const,
      }),
    })
  );
  if (limited.kind === "unavailable") {
    return withMcpResponseHeaders(mcpTransportErrorResponse(503), request);
  }
  if (limited.kind === "limited") {
    return withMcpResponseHeaders(
      mcpTransportErrorResponse(429, limited.retryAfterMs),
      request
    );
  }
  const bounded = yield* readMcpRequest(request).pipe(Effect.result);
  if (Result.isFailure(bounded)) {
    const oversized = bounded.failure.reason === "size";
    return withMcpResponseHeaders(
      mcpTransportErrorResponse(oversized ? 413 : 400),
      request
    );
  }
  const { parsedBody, request: boundedRequest } = bounded.success;
  const runtime = yield* loadMcpRuntime().pipe(Effect.result);
  if (Result.isFailure(runtime)) {
    return withMcpResponseHeaders(
      mcpParsedErrorResponse(
        parsedBody,
        503,
        -32_603,
        "The MCP protocol runtime is unavailable.",
        requestId
      ),
      request
    );
  }
  if (
    parsedBody !== undefined &&
    !request.headers.has("mcp-protocol-version")
  ) {
    return withMcpResponseHeaders(
      mcpParsedErrorResponse(
        parsedBody,
        400,
        -32_020,
        "The MCP-Protocol-Version header is required for modern requests.",
        requestId
      ),
      request
    );
  }
  const server = yield* runtime.success.server.createNakafaMcpServer(requestId);
  const handler = runtime.success.sdk.createMcpHandler(() => server, {
    legacy: "reject",
    onerror: (error) => {
      Effect.runSyncWith(runtimeServices)(
        Effect.logWarning("Nakafa MCP protocol request failed.").pipe(
          Effect.annotateLogs({
            errorName: error.name,
            requestId,
          })
        )
      );
    },
  });
  return withMcpResponseHeaders(
    yield* Effect.promise(() =>
      handler.fetch(boundedRequest, {
        parsedBody,
      })
    ),
    request
  );
}).pipe(Effect.map(HttpServerResponse.fromWeb));
export const agentMcpRoutes = HttpRouter.add(
  "*",
  NAKAFA_MCP_EDGE_CONTRACT.originPath,
  handleMcp
).pipe(Layer.provide(guardMcpOrigin.layer));
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
      ]).then(([sdk, server]) => ({
        sdk,
        server,
      })),
  })
);
