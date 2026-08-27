import "server-only";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import type { NakafaProblemDetails } from "@repo/contents/_lib/agent/schema/api";
import { Config, Effect, Redacted, Schema } from "effect";

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "baggage",
  "if-none-match",
  "traceparent",
  "tracestate",
  "x-forwarded-for",
] as const;
const FORWARDED_RESPONSE_HEADERS = [
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "allow",
  "cache-control",
  "content-type",
  "etag",
  "retry-after",
  "vary",
] as const;
const bridgeConfig = Config.all({
  origin: Config.url(NAKAFA_API_EDGE_CONTRACT.originEnvironment),
  secret: Config.schema(
    Schema.Redacted(Schema.Trimmed.check(Schema.isNonEmpty())),
    NAKAFA_API_EDGE_CONTRACT.secretEnvironment
  ),
});

/** Expected failure at the public API bridge boundary. */
class ApiBridgeError extends Schema.TaggedError<ApiBridgeError>()(
  "ApiBridgeError",
  {
    cause: Schema.Unknown,
    reason: Schema.Literals(["configuration", "path", "transport"]),
  }
) {}

/** Runs the V2-only Convex bridge at the Next.js route boundary. */
export function bridgePublicApiRequest(request: Request) {
  return Effect.runPromise(bridgePublicApi(request));
}

/** Resolves one public bridge request without starting a nested runtime. */
export const bridgePublicApi = Effect.fn("ApiBridge.request")(function* (
  request: Request
) {
  return yield* forwardPublicApiRequest(request).pipe(
    Effect.tapError((error) =>
      Effect.logError("Nakafa public API bridge failure.", error).pipe(
        Effect.annotateLogs({ path: new URL(request.url).pathname })
      )
    ),
    Effect.catchTag("ApiBridgeError", (error) =>
      Effect.succeed(bridgeProblemResponse(request, error.reason))
    )
  );
});

/** Forwards one allowlisted request without exposing the origin credential. */
const forwardPublicApiRequest = Effect.fn("ApiBridge.forward")(function* (
  request: Request
) {
  const publicUrl = new URL(request.url);
  if (!isBridgedPath(publicUrl.pathname)) {
    return yield* new ApiBridgeError({
      cause: publicUrl.pathname,
      reason: "path",
    });
  }
  const config = yield* bridgeConfig.pipe(
    Effect.mapError(
      (cause) => new ApiBridgeError({ cause, reason: "configuration" })
    )
  );
  const originUrl = new URL(
    `${NAKAFA_API_EDGE_CONTRACT.originPath}${publicUrl.pathname}${publicUrl.search}`,
    config.origin
  );
  const headers = pickHeaders(request.headers, FORWARDED_REQUEST_HEADERS);
  headers.set(
    NAKAFA_API_EDGE_CONTRACT.secretHeader,
    Redacted.value(config.secret)
  );
  const response = yield* Effect.tryPromise({
    catch: (cause) => new ApiBridgeError({ cause, reason: "transport" }),
    try: () =>
      fetch(originUrl, {
        cache: "no-store",
        headers,
        method: request.method,
        redirect: "manual",
        signal: request.signal,
      }),
  });
  return new Response(response.body, {
    headers: pickHeaders(response.headers, FORWARDED_RESPONSE_HEADERS),
    status: response.status,
    statusText: response.statusText,
  });
});

/** Restricts the bridge to the explicit successor and its contract document. */
function isBridgedPath(pathname: string) {
  return (
    pathname === "/openapi.json" ||
    pathname === "/v2" ||
    pathname.startsWith("/v2/")
  );
}

/** Copies only headers with a reviewed end-to-end purpose. */
function pickHeaders(source: Headers, names: readonly string[]): Headers {
  const selected = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) {
      selected.set(name, value);
    }
  }
  return selected;
}

/** Returns one public, credential-free failure for bridge-owned errors. */
function bridgeProblemResponse(
  request: Request,
  reason: ApiBridgeError["reason"]
) {
  const path = new URL(request.url).pathname;
  const missing = reason === "path";
  const status = missing ? 404 : 503;
  const body: NakafaProblemDetails = {
    code: missing ? "ENDPOINT_NOT_FOUND" : "EDGE_SERVICE_UNAVAILABLE",
    detail: missing
      ? "The requested public API endpoint does not exist."
      : "The public API origin could not be reached.",
    instance: path,
    request_id: crypto.randomUUID(),
    resolution: missing
      ? "Consult https://api.nakafa.com/openapi.json."
      : "Retry later using the same documented inputs.",
    status,
    title: missing ? "Endpoint not found" : "Service unavailable",
    type: `https://nakafa.com/problems/${missing ? "endpoint-not-found" : "service-unavailable"}`,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/problem+json; charset=utf-8",
      Vary: "Accept, Accept-Encoding",
    },
    status,
  });
}
