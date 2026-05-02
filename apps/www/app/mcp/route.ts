import { Effect, Schema } from "effect";
import { env } from "@/env";

const MCP_ENDPOINT = new URL("/mcp", env.NEXT_PUBLIC_MCP_URL);
const MCP_UPSTREAM_UNAVAILABLE_MESSAGE = "MCP upstream is unavailable";
const MCP_DISCOVERY_TEXT = [
  "# Nakafa MCP Server",
  "",
  "Nakafa exposes a Streamable HTTP MCP endpoint at https://nakafa.com/mcp.",
  "MCP clients should send JSON-RPC POST requests with Accept: application/json, text/event-stream and Content-Type: application/json.",
  "Available tools: get_contents and get_content.",
  "",
].join("\n");

const MCP_DISCOVERY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
};

const CONNECTION_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-encoding",
  "content-type",
  "last-event-id",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
  "mcp-session-id",
]);

const FETCH_DECODED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
]);

/** Error used for failures that should return the MCP proxy 502 response. */
class McpUpstreamUnavailableError extends Schema.TaggedError<McpUpstreamUnavailableError>()(
  "McpUpstreamUnavailableError",
  {
    message: Schema.String,
  }
) {}

/** Checks whether an incoming request header is safe to forward upstream. */
function shouldForwardRequestHeader(header: string) {
  const normalizedHeader = header.toLowerCase();

  if (FORWARDED_REQUEST_HEADERS.has(normalizedHeader)) {
    return true;
  }

  return normalizedHeader.startsWith("mcp-param-");
}

/** Copies protocol headers without leaking browser credentials upstream. */
function getForwardHeaders(request: Request) {
  const headers = new Headers();

  for (const [header, value] of request.headers) {
    if (!shouldForwardRequestHeader(header)) {
      continue;
    }

    headers.set(header, value);
  }

  return headers;
}

/** Serves crawler-friendly MCP discovery without opening an SSE stream. */
function getMcpDiscoveryResponse() {
  return new Response(MCP_DISCOVERY_TEXT, {
    headers: MCP_DISCOVERY_HEADERS,
  });
}

/** Forwards MCP HTTP requests to the configured MCP service. */
function proxyMcpRequest(request: Request) {
  const upstreamUrl = new URL(MCP_ENDPOINT);
  upstreamUrl.search = new URL(request.url).search;

  return Effect.runPromise(
    Effect.gen(function* () {
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : yield* Effect.tryPromise({
              try: () => request.arrayBuffer(),
              catch: () =>
                new McpUpstreamUnavailableError({
                  message: MCP_UPSTREAM_UNAVAILABLE_MESSAGE,
                }),
            });
      const upstream = yield* Effect.tryPromise({
        try: () =>
          fetch(upstreamUrl, {
            body,
            cache: "no-store",
            headers: getForwardHeaders(request),
            method: request.method,
            redirect: "manual",
          }),
        catch: () =>
          new McpUpstreamUnavailableError({
            message: MCP_UPSTREAM_UNAVAILABLE_MESSAGE,
          }),
      });
      const headers = new Headers(upstream.headers);

      for (const header of [
        ...CONNECTION_HEADERS,
        ...FETCH_DECODED_RESPONSE_HEADERS,
      ]) {
        headers.delete(header);
      }

      return new Response(upstream.body, {
        headers,
        status: upstream.status,
        statusText: upstream.statusText,
      });
    }).pipe(
      Effect.catchTag("McpUpstreamUnavailableError", (error) =>
        Effect.succeed(
          new Response(error.message, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
            status: 502,
          })
        )
      )
    )
  );
}

/** Handles browser discovery requests and real MCP GET streams. */
export function GET(request: Request) {
  if (!request.headers.get("accept")?.includes("text/event-stream")) {
    return getMcpDiscoveryResponse();
  }

  return proxyMcpRequest(request);
}

/** Lets crawlers validate the MCP endpoint without opening a stream. */
export function HEAD() {
  return new Response(null, {
    headers: MCP_DISCOVERY_HEADERS,
  });
}

export const POST = proxyMcpRequest;
export const DELETE = proxyMcpRequest;
export const OPTIONS = proxyMcpRequest;
