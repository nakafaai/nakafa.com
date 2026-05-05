import { Effect, Option } from "effect";

const NAKAFA_APP_HOSTNAME = "nakafa.com";

const DEFAULT_ALLOWED_EXACT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
] as const;

const DEFAULT_ALLOWED_CORS_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "last-event-id",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
  "mcp-session-id",
] as const;

const EXPOSED_MCP_HEADERS = ["mcp-protocol-version", "mcp-session-id"] as const;

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
      return withMcpCorsHeaders(
        new Response(null, { status: 204 }),
        origin,
        request
      );
    }

    const response = yield* Effect.promise(() => handler(request));
    return withMcpCorsHeaders(response, origin, request);
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

  const normalizedOrigin = new URL(origin);

  if (!isAllowedMcpOrigin(normalizedOrigin, extraAllowedOrigins)) {
    return Option.none<string>();
  }

  return Option.some(normalizedOrigin.origin);
}

/** Builds the configured exact Origin allow-list. */
export function getAllowedMcpOrigins(extraAllowedOrigins = "") {
  return new Set(
    [
      ...DEFAULT_ALLOWED_EXACT_ORIGINS,
      ...extraAllowedOrigins.split(","),
    ].flatMap((origin) =>
      Option.match(normalizeMcpOrigin(origin), {
        onNone: () => [],
        onSome: (normalizedOrigin) => [normalizedOrigin],
      })
    )
  );
}

/** Adds browser CORS headers only when a concrete Origin was allowed. */
function withMcpCorsHeaders(
  response: Response,
  origin: Option.Option<string>,
  request: Request
) {
  if (Option.isNone(origin) || origin.value.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin.value);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    getAllowedCorsHeaders(request).join(",")
  );
  headers.set("Access-Control-Expose-Headers", EXPOSED_MCP_HEADERS.join(","));
  headers.append("Vary", "Origin");
  headers.append("Vary", "Access-Control-Request-Headers");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** Canonicalizes configured and request Origin values before comparison. */
function normalizeMcpOrigin(origin: string) {
  const trimmedOrigin = origin.trim();

  if (!URL.canParse(trimmedOrigin)) {
    return Option.none();
  }

  return Option.some(new URL(trimmedOrigin).origin);
}

/** Checks whether an Origin belongs to Nakafa's owned production app domain. */
function isNakafaAppOrigin(origin: URL) {
  if (origin.protocol !== "https:") {
    return false;
  }

  if (origin.hostname === NAKAFA_APP_HOSTNAME) {
    return true;
  }

  return origin.hostname.endsWith(`.${NAKAFA_APP_HOSTNAME}`);
}

/** Checks exact development/custom origins and owned Nakafa production apps. */
function isAllowedMcpOrigin(origin: URL, extraAllowedOrigins: string) {
  if (isNakafaAppOrigin(origin)) {
    return true;
  }

  return getAllowedMcpOrigins(extraAllowedOrigins).has(origin.origin);
}

/** Returns the CORS request headers this MCP endpoint supports. */
function getAllowedCorsHeaders(request: Request) {
  const requestedHeaders = request.headers.get(
    "access-control-request-headers"
  );

  if (!requestedHeaders) {
    return [...DEFAULT_ALLOWED_CORS_HEADERS];
  }

  return requestedHeaders
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(isAllowedCorsHeader);
}

/** Checks one browser-requested CORS header against the MCP header contract. */
function isAllowedCorsHeader(header: string) {
  if (
    DEFAULT_ALLOWED_CORS_HEADERS.some(
      (allowedHeader) => allowedHeader === header
    )
  ) {
    return true;
  }

  return header.startsWith("mcp-param-");
}
