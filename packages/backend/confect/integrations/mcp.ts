import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  type QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { SCHOOL_MCP_PATH } from "@repo/backend/confect/integrations/api";
import { schoolMcpEngine } from "@repo/backend/confect/integrations/tools";
import {
  SCHOOL_CAPABILITIES,
  withDiscoveryCapabilities,
} from "@repo/backend/confect/routes/agent/mcp/discovery";
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
import { Effect, Layer, Option, Result, String as Str } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** The JSON-RPC code of a modern request without its protocol version header, as the Nakafa server answers it. */
const MISSING_PROTOCOL_CODE = -32_020;

/** The scheme word of an Authorization header that carries a bearer token. */
const BEARER_PREFIX = "Bearer ";

/** The bearer token of a request, or none when it sends no bearer Authorization header. */
const bearerOf = (request: Request) =>
  Option.flatMap(Option.fromNullOr(request.headers.get("authorization")), (value) =>
    Str.startsWith(BEARER_PREFIX)(value)
      ? Option.some(value.slice(BEARER_PREFIX.length))
      : Option.none()
  );

/** A refused bearer token: 401 with the challenge an MCP client reads (RFC 6750). */
const unauthorized = () => {
  const response = mcpTransportErrorResponse(401);
  const headers = new Headers(response.headers);
  headers.set("WWW-Authenticate", 'Bearer realm="nakafa-school"');
  return new Response(response.body, { headers, status: 401 });
};

/**
 * Serves the school MCP server (ADR 0029): the bearer token must be live and issued for the
 * MCP resource, the request is counted against its client's limit, and then the same
 * transport rules as the Nakafa MCP server apply before Effect's engine answers. Every tool
 * reads only what the client's action list and scope open.
 */
const handleSchoolMcp = Effect.gen(function* () {
  const services = yield* Effect.context<QueryRunner>();
  const request = yield* HttpServerRequest.toWeb(
    yield* HttpServerRequest.HttpServerRequest
  );
  const requestId = yield* RequestIdentity;
  if (request.method === "OPTIONS") {
    return mcpOptionsResponse(request);
  }
  const { runMutation } = yield* MutationRunner;
  const check = yield* runMutation(refs.internal.integrations.tokens.check, {
    resource: "mcp",
    token: Option.getOrElse(bearerOf(request), () => ""),
  }).pipe(Effect.orDie);
  if (check.outcome === "unauthorized") {
    return withMcpResponseHeaders(unauthorized(), request);
  }
  if (check.outcome === "limited") {
    return withMcpResponseHeaders(
      mcpTransportErrorResponse(429, check.retryAfter * 1000),
      request
    );
  }
  const bounded = yield* readMcpRequest(request).pipe(Effect.result);
  if (Result.isFailure(bounded)) {
    return withMcpResponseHeaders(
      mcpTransportErrorResponse(bounded.failure.reason === "size" ? 413 : 400),
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
        MISSING_PROTOCOL_CODE,
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
    schoolMcpEngine({
      allowedOrigins: [],
      clientId: check.clientId,
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
    HttpServerResponse.toWeb(response),
    SCHOOL_CAPABILITIES
  );
  return withMcpResponseHeaders(answered, request);
}).pipe(Effect.map(HttpServerResponse.fromWeb));

/** Every answer is JSON, so the engine always receives an Accept that names both of its media types. */
function withEngineAccept(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(request, { headers });
}

/** The school MCP route at its Convex path; a school host forwards its `/mcp` path here. */
export const schoolMcpRoutes = HttpRouter.add("*", SCHOOL_MCP_PATH, handleSchoolMcp);
