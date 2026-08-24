import { Config, Effect, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

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

export const AgentOriginSurfaceSchema = Schema.Literals(["api", "mcp"]);
export type AgentOriginSurface = typeof AgentOriginSurfaceSchema.Type;

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
    surface: AgentOriginSurfaceSchema,
  }
) {}

const surfaceConfig = {
  api: {
    edgeSecret: "NAKAFA_API_EDGE_SECRET",
    edgeSecretHeader: "x-nakafa-api-edge-secret",
    pathname: "/v1",
  },
  mcp: {
    edgeSecret: "NAKAFA_MCP_EDGE_SECRET",
    edgeSecretHeader: "x-nakafa-mcp-edge-secret",
    pathname: "/mcp",
  },
} as const;

const proxyEnvironment = Config.all({
  origin: Config.url("NAKAFA_CONVEX_SITE_URL"),
  vercelEnvironment: Config.string("VERCEL_ENV").pipe(Config.withDefault("")),
});

/** Reads one bounded request body for the local development transport. */
const readRequestBody = Effect.fn("agent.proxy.readRequestBody")(
  (request: Request, surface: AgentOriginSurface) =>
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
  surface: AgentOriginSurface,
  origin: URL,
  edgeSecret: Redacted.Redacted<string>
) {
  const input = surfaceConfig[surface];
  const incomingUrl = new URL(request.url);
  const validPath =
    incomingUrl.pathname === input.pathname ||
    (surface === "api" &&
      incomingUrl.pathname.startsWith(`${input.pathname}/`));
  if (!validPath) {
    return yield* new AgentOriginProxyError({ reason: "path", surface });
  }

  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete(surfaceConfig.api.edgeSecretHeader);
  headers.delete(surfaceConfig.mcp.edgeSecretHeader);
  headers.set("accept-encoding", "identity");
  headers.set(input.edgeSecretHeader, Redacted.value(edgeSecret));

  const destination = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    origin
  );
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? yield* readRequestBody(request, surface) : undefined;
  return new Request(destination, {
    body,
    headers,
    method: request.method,
    signal: request.signal,
  });
});

/**
 * Proxies a documented local API or MCP command to the selected Convex origin.
 * Vercel production rejects this adapter so public traffic remains edge-only.
 */
export const proxyAgentOriginRequest = Effect.fn(
  "agent.proxy.proxyAgentOriginRequest"
)(function* (request: Request, surface: AgentOriginSurface) {
  const environment = yield* proxyEnvironment.pipe(
    Effect.mapError(
      () => new AgentOriginProxyError({ reason: "configuration", surface })
    )
  );
  if (environment.vercelEnvironment === "production") {
    return yield* new AgentOriginProxyError({ reason: "production", surface });
  }

  const edgeSecret = yield* Config.redacted(
    surfaceConfig[surface].edgeSecret
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
