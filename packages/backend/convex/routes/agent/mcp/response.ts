const DEFAULT_ALLOWED_HEADERS = [
  "accept",
  "baggage",
  "content-type",
  "last-event-id",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
  "mcp-session-id",
  "traceparent",
  "tracestate",
] as const;
const EXPOSED_HEADERS = [
  "MCP-Protocol-Version",
  "MCP-Session-ID",
  "Retry-After",
] as const;

/** Builds one no-store JSON-RPC error at the protected HTTP boundary. */
export function mcpErrorResponse(
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
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        ...(retryAfter === undefined
          ? {}
          : { "Retry-After": String(retryAfter) }),
      },
      status,
    }
  );
}

/** Rejects an unprocessed transport request without emitting JSON-RPC. */
export function mcpTransportErrorResponse(
  status: number,
  retryAfterMilliseconds?: number
) {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfterMilliseconds === undefined
        ? {}
        : {
            "Retry-After": String(
              Math.max(1, Math.ceil(retryAfterMilliseconds / 1000))
            ),
          }),
    },
    status,
  });
}

/** Maps an error after parsing while preserving notification semantics. */
export function mcpParsedErrorResponse(
  body: unknown,
  status: number,
  code: number,
  message: string,
  requestId: string
) {
  return isJsonRpcNotification(body)
    ? mcpTransportErrorResponse(status)
    : mcpErrorResponse(
        status,
        code,
        message,
        requestId,
        readJsonRpcRequestId(body)
      );
}

/** Adds CORS and cache metadata without replacing SDK protocol headers. */
export function withMcpResponseHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  if (origin !== null) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", readAllowedHeaders(request));
  headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS.join(","));
  headers.set("Cache-Control", "no-store");
  headers.append("Vary", "Origin");
  headers.append("Vary", "Access-Control-Request-Headers");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** Returns the successful browser preflight contract. */
export function mcpOptionsResponse(request: Request) {
  return withMcpResponseHeaders(new Response(null, { status: 204 }), request);
}

/** Recovers an echoable JSON-RPC request ID from the bounded parsed value. */
export function readJsonRpcRequestId(body: unknown) {
  if (typeof body !== "object" || body === null || !("id" in body)) {
    return null;
  }
  const id = body.id;
  return typeof id === "number" || typeof id === "string" ? id : null;
}

function isJsonRpcNotification(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    !("id" in body) &&
    "jsonrpc" in body &&
    body.jsonrpc === "2.0" &&
    "method" in body &&
    typeof body.method === "string"
  );
}

function readAllowedHeaders(request: Request) {
  const requested = request.headers.get("access-control-request-headers");
  if (requested === null) {
    return DEFAULT_ALLOWED_HEADERS.join(",");
  }
  return requested
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(
      (header) =>
        DEFAULT_ALLOWED_HEADERS.some((allowed) => allowed === header) ||
        header.startsWith("mcp-param-")
    )
    .join(",");
}
