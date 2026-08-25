import { Config, Effect, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  type AgentEdgeSurface,
  AgentEdgeSurfaceSchema,
  getAgentEdgeContract,
  NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
} from "./edge";

const MAXIMUM_PROXY_REQUEST_BYTES = 2 * 1024 * 1024;
const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

/** A local agent adapter could not forward one request to its Convex origin. */
export class AgentOriginProxyError extends Schema.TaggedError<AgentOriginProxyError>()(
  "AgentOriginProxyError",
  {
    reason: Schema.Literals([
      "configuration",
      "path",
      "production",
      "request-body",
      "transport",
    ]),
    surface: AgentEdgeSurfaceSchema,
  }
) {}

const proxyEnvironment = Config.all({
  origin: Config.url(NAKAFA_CONVEX_SITE_URL_ENVIRONMENT),
  vercelEnvironment: Config.string("VERCEL_ENV").pipe(Config.withDefault("")),
});

/** Reads one bounded request body for the local development transport. */
const readRequestBody = Effect.fn("agent.proxy.readRequestBody")(
  (request: Request, surface: AgentEdgeSurface) =>
    Effect.tryPromise({
      catch: () =>
        new AgentOriginProxyError({ reason: "request-body", surface }),
      try: () => request.arrayBuffer(),
    }).pipe(
      Effect.filterOrFail(
        (body) => body.byteLength <= MAXIMUM_PROXY_REQUEST_BYTES,
        () => new AgentOriginProxyError({ reason: "request-body", surface })
      )
    )
);

/** Builds one upstream request without forwarding caller-owned secret headers. */
const makeOriginRequest = Effect.fn("agent.proxy.makeOriginRequest")(function* (
  request: Request,
  surface: AgentEdgeSurface,
  origin: URL,
  edgeSecret: Redacted.Redacted<string>
) {
  const input = getAgentEdgeContract(surface);
  const incomingUrl = new URL(request.url);
  const destinationPath = resolveDestinationPath(surface, incomingUrl.pathname);
  if (!destinationPath) {
    return yield* new AgentOriginProxyError({ reason: "path", surface });
  }

  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete(getAgentEdgeContract("api").secretHeader);
  headers.delete(getAgentEdgeContract("mcp").secretHeader);
  headers.set("accept-encoding", "identity");
  headers.set(input.secretHeader, Redacted.value(edgeSecret));

  const destination = new URL(
    `${destinationPath}${incomingUrl.search}`,
    origin
  );
  const hasBody = request.body !== null;
  const body = hasBody ? yield* readRequestBody(request, surface) : undefined;
  return new Request(destination, {
    body,
    headers,
    method: request.method,
    signal: request.signal,
  });
});

/** Maps each public local path to its owning Convex HTTP Action route. */
function resolveDestinationPath(surface: AgentEdgeSurface, pathname: string) {
  if (surface === "api") {
    if (pathname === "/v1" || pathname.startsWith("/v1/")) {
      return pathname;
    }
    return null;
  }
  if (pathname === "/mcp") {
    return "/mcp";
  }
  if (pathname === "/health") {
    return "/mcp/health";
  }
  return null;
}

/**
 * Proxies a documented local API or MCP command to the selected Convex origin.
 * Vercel production rejects this adapter so public traffic remains edge-only.
 */
export const proxyAgentOriginRequest = Effect.fn(
  "agent.proxy.proxyAgentOriginRequest"
)(function* (request: Request, surface: AgentEdgeSurface) {
  const environment = yield* proxyEnvironment.pipe(
    Effect.mapError(
      () => new AgentOriginProxyError({ reason: "configuration", surface })
    )
  );
  if (environment.vercelEnvironment === "production") {
    return yield* new AgentOriginProxyError({ reason: "production", surface });
  }

  const edgeSecret = yield* Config.redacted(
    getAgentEdgeContract(surface).secretEnvironment
  ).pipe(
    Effect.mapError(
      () => new AgentOriginProxyError({ reason: "configuration", surface })
    )
  );
  const originRequest = yield* makeOriginRequest(
    request,
    surface,
    environment.origin,
    edgeSecret
  );
  const fetch = yield* FetchHttpClient.Fetch;
  return yield* Effect.tryPromise({
    catch: () => new AgentOriginProxyError({ reason: "transport", surface }),
    try: () => fetch(originRequest, { redirect: "manual" }),
  });
});
