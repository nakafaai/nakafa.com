import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { nakafaMcpEngine } from "@repo/backend/agent/mcp/server";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { enforceAgentReadLimit } from "@repo/backend/confect/routes/agent/limit";
import { withDiscoveryCapabilities } from "@repo/backend/confect/routes/agent/mcp/discovery";
import { guardMcpOrigin } from "@repo/backend/confect/routes/agent/mcp/guard";
import { readMcpRequest } from "@repo/backend/confect/routes/agent/mcp/input";
import {
  refuseMcpRequest,
  refuseUnservedMethod,
} from "@repo/backend/confect/routes/agent/mcp/refusal";
import {
  isJsonRpcNotification,
  mcpOptionsResponse,
  mcpParsedErrorResponse,
  mcpTransportErrorResponse,
  withMcpResponseHeaders,
} from "@repo/backend/confect/routes/agent/mcp/response";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { Effect, Layer, Option, Result } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** Serves the protected Streamable HTTP MCP transport: Nakafa's checks, then Effect's engine. */
const handleMcp = Effect.gen(function* () {
  const services = yield* Effect.context<QueryRunner>();
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
  const refusal = refuseMcpRequest(boundedRequest, parsedBody);
  if (Option.isSome(refusal)) {
    return withMcpResponseHeaders(refusal.value, request);
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
  if (isJsonRpcNotification(parsedBody)) {
    return withMcpResponseHeaders(mcpTransportErrorResponse(202), request);
  }
  const unserved = refuseUnservedMethod(parsedBody);
  if (Option.isSome(unserved)) {
    return withMcpResponseHeaders(unserved.value, request);
  }
  const engine = yield* HttpRouter.toHttpEffect(
    nakafaMcpEngine({
      allowedOrigins: origins(request),
      requestId,
      services,
    }).pipe(Layer.orDie)
  );
  const response = yield* engine.pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(withEngineAccept(boundedRequest))
    )
  );
  const answered = yield* withDiscoveryCapabilities(
    parsedBody,
    HttpServerResponse.toWeb(response)
  );
  return withMcpResponseHeaders(answered, request);
}).pipe(Effect.map(HttpServerResponse.fromWeb));

/** The Origin the edge guard already accepted, which the engine must also accept. */
function origins(request: Request): readonly string[] {
  const origin = request.headers.get("origin");
  return origin === null ? [] : [origin];
}

/**
 * Nakafa does not enforce the Accept header. Every answer is JSON, so a client
 * that names only one media type loses nothing. The engine refuses a request
 * whose Accept does not name both JSON and an event stream, so the engine always
 * receives both.
 */
function withEngineAccept(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(request, { headers });
}

export const agentMcpRoutes = HttpRouter.add(
  "*",
  NAKAFA_MCP_EDGE_CONTRACT.originPath,
  handleMcp
).pipe(Layer.provide(guardMcpOrigin.layer));
