import { Effect, Option } from "effect";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://nakafa.com",
  "https://www.nakafa.com",
  "https://mcp.nakafa.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
] as const;

/** Wraps the MCP route with Origin validation and CORS headers. */
export function withMcpOriginGuard(
  handler: (request: Request) => Promise<Response>,
  extraAllowedOrigins = ""
) {
  return (request: Request) =>
    Effect.runPromise(
      handleMcpOriginGuardedRequest(request, handler, extraAllowedOrigins)
    );
}

/** Validates one request and delegates only when its Origin is allowed. */
function handleMcpOriginGuardedRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  extraAllowedOrigins: string
) {
  return Effect.gen(function* () {
    const origin = getAllowedRequestOrigin(request, extraAllowedOrigins);

    if (Option.isNone(origin) && request.headers.has("origin")) {
      return new Response("Forbidden MCP Origin", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        status: 403,
      });
    }

    if (request.method === "OPTIONS") {
      return withMcpCorsHeaders(new Response(null, { status: 204 }), origin);
    }

    const response = yield* Effect.promise(() => handler(request));
    return withMcpCorsHeaders(response, origin);
  });
}

/** Returns the request Origin when it is absent or explicitly allowed. */
export function getAllowedRequestOrigin(
  request: Request,
  extraAllowedOrigins = ""
) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return Option.some("");
  }

  if (!URL.canParse(origin)) {
    return Option.none<string>();
  }

  if (!getAllowedMcpOrigins(extraAllowedOrigins).has(new URL(origin).origin)) {
    return Option.none<string>();
  }

  return Option.some(new URL(origin).origin);
}

/** Builds the configured Origin allow-list. */
export function getAllowedMcpOrigins(extraAllowedOrigins = "") {
  return new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...extraAllowedOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

/** Adds browser CORS headers only when a concrete Origin was allowed. */
function withMcpCorsHeaders(response: Response, origin: Option.Option<string>) {
  if (Option.isNone(origin) || origin.value.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin.value);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "accept,authorization,content-type,mcp-protocol-version,mcp-session-id"
  );
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
