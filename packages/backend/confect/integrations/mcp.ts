import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import {
  Auth,
  MutationRunner,
  type QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { agentMcpEngine } from "@repo/backend/confect/integrations/agent";
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
import { Effect, Exit, Layer, Option, Result, String as Str } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** The JSON-RPC code of a modern request without its protocol version header, as the Nakafa server answers it. */
const MISSING_PROTOCOL_CODE = -32_020;

/** The scheme word of an Authorization header that carries a bearer token. */
const BEARER_PREFIX = "Bearer ";

/** The bearer token of a request, or none when it sends no bearer Authorization header. */
const bearerOf = (request: Request) =>
  Option.flatMap(
    Option.fromNullOr(request.headers.get("authorization")),
    (value) =>
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

/** Whether a bearer token is a signed Convex token. A client's token is one opaque word. */
const isSignedToken = (token: string) => Str.split(".")(token).length === 3;

/**
 * What a bearer token opens. A signed Convex token is a person's, from the sign-in of their
 * agent, and Convex has verified it when the identity reads. Any other token is an integration
 * client's, live, issued for the MCP resource and counted against its limit.
 */
const readAccess = Effect.fn("integrations.mcp.access")(function* (
  token: string
) {
  if (!isSignedToken(token)) {
    const { runMutation } = yield* MutationRunner;
    return yield* runMutation(integrationsInternal.tokens.check, {
      resource: "mcp",
      token,
    }).pipe(Effect.orDie);
  }
  const identity = yield* Effect.exit((yield* Auth).getUserIdentity);
  return {
    outcome: Exit.isSuccess(identity) ? "person" : "unauthorized",
  } as const;
});

/**
 * Serves the school MCP server (ADR 0029): the bearer token must be a person's or a live
 * client's, and then the same transport rules as the Nakafa MCP server apply before Effect's
 * engine answers. A client's tool reads only what its action list and scope open, and a
 * person's tools run every public function as that person.
 */
const handleSchoolMcp = Effect.gen(function* () {
  const services = yield* Effect.context<MutationRunner | QueryRunner>();
  const request = yield* HttpServerRequest.toWeb(
    yield* HttpServerRequest.HttpServerRequest
  );
  const requestId = yield* RequestIdentity;
  if (request.method === "OPTIONS") {
    return mcpOptionsResponse(request);
  }
  const token = Option.getOrElse(bearerOf(request), () => "");
  const check = yield* readAccess(token);
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
    check.outcome === "person"
      ? agentMcpEngine({ allowedOrigins: [], requestId, token }).pipe(
          Layer.orDie
        )
      : schoolMcpEngine({
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
export const schoolMcpRoutes = HttpRouter.add(
  "*",
  SCHOOL_MCP_PATH,
  handleSchoolMcp
);
