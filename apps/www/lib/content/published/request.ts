import "server-only";

import {
  type ContentRuntimeRequest,
  type ContentRuntimeResponse,
  decodeContentRuntimeRequest,
  decodeContentRuntimeResponse,
  MAX_RUNTIME_REQUEST_BYTES,
  MAX_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect } from "effect";
import { env } from "@/env";
import { ContentTransportError } from "@/lib/content/published/errors";

const RUNTIME_PATH = "/internal/content/runtime";
const RUNTIME_TIMEOUT_MILLISECONDS = 10_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

/** One decoded server-runtime exchange before cryptographic verification. */
interface ContentRuntimeExchange {
  readonly request: ContentRuntimeRequest;
  readonly response: ContentRuntimeResponse;
  readonly status: number;
}

/** Builds the fixed Convex endpoint without inheriting paths or credentials. */
const createRuntimeUrl = Effect.fn("NakafaContent.createRuntimeUrl")(function* (
  baseUrl: string
) {
  const base = yield* Effect.try({
    catch: () => new ContentTransportError({ reason: "url" }),
    try: () => new URL(baseUrl),
  });
  const isLocalHttp =
    base.protocol === "http:" && LOOPBACK_HOSTS.has(base.hostname);
  if (
    (base.protocol !== "https:" && !isLocalHttp) ||
    base.username.length + base.password.length > 0
  ) {
    return yield* new ContentTransportError({ reason: "url" });
  }

  return new URL(RUNTIME_PATH, base.origin).href;
});

/** Enforces the endpoint's exact status vocabulary for each response variant. */
function validateRuntimeStatus(
  response: ContentRuntimeResponse,
  status: number
) {
  if (response.kind === "found" && status === 200) {
    return Effect.void;
  }
  if (response.kind === "missing" && status === 404) {
    return Effect.void;
  }
  if (
    response.kind === "failure" &&
    ((response.code === "CONTENT_RUNTIME_FORBIDDEN" && status === 403) ||
      (response.code === "CONTENT_RUNTIME_INTERNAL" && status === 500) ||
      (response.code === "CONTENT_RUNTIME_INVALID" &&
        (status === 400 || status === 413 || status === 415)) ||
      (response.code === "CONTENT_RUNTIME_UNAUTHORIZED" && status === 401))
  ) {
    return Effect.void;
  }
  return Effect.fail(new ContentTransportError({ reason: "status" }));
}

/** Reads and decodes one response without trusting advertised byte counts. */
const readRuntimeResponse = Effect.fn("NakafaContent.readRuntimeResponse")(
  function* (response: Response, endpoint: string) {
    if (response.url !== endpoint) {
      return yield* new ContentTransportError({ reason: "response-url" });
    }
    if (!isJsonContentType(response.headers.get("content-type"))) {
      return yield* new ContentTransportError({ reason: "content-type" });
    }
    yield* parseContentLength(
      response.headers.get("content-length"),
      MAX_RUNTIME_RESPONSE_BYTES
    ).pipe(
      Effect.mapError(
        () => new ContentTransportError({ reason: "content-length" })
      )
    );
    const bytes = yield* readBoundedBody(
      response.body,
      MAX_RUNTIME_RESPONSE_BYTES
    ).pipe(
      Effect.mapError(
        (error) =>
          new ContentTransportError({
            reason: error._tag === "BodyLimitError" ? "response-size" : "body",
          })
      )
    );
    const source = yield* Effect.try({
      catch: () => new ContentTransportError({ reason: "body" }),
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    });
    const input = yield* Effect.try({
      catch: () => new ContentTransportError({ reason: "json" }),
      try: (): unknown => JSON.parse(source),
    });
    const decoded = yield* decodeContentRuntimeResponse(input);
    yield* validateRuntimeStatus(decoded, response.status);

    return decoded;
  }
);

/** Posts one public material request through the private bounded Convex seam. */
export const fetchPublicContentRuntime = Effect.fn(
  "NakafaContent.fetchPublicContentRuntime"
)(function* (input: unknown) {
  const untrustedSource = yield* Effect.try({
    catch: () => new ContentTransportError({ reason: "request" }),
    try: () => JSON.stringify(input),
  });
  if (untrustedSource === undefined) {
    return yield* new ContentTransportError({ reason: "request" });
  }
  if (
    new TextEncoder().encode(untrustedSource).byteLength >
    MAX_RUNTIME_REQUEST_BYTES
  ) {
    return yield* new ContentTransportError({ reason: "request-size" });
  }
  const request = yield* decodeContentRuntimeRequest(input);
  if (request.delivery !== "public") {
    return yield* new ContentTransportError({ reason: "delivery" });
  }
  const source = JSON.stringify(request);
  const endpoint = yield* createRuntimeUrl(env.NEXT_PUBLIC_CONVEX_SITE_URL);
  const response = yield* Effect.tryPromise({
    catch: () => new ContentTransportError({ reason: "fetch" }),
    try: () =>
      fetch(endpoint, {
        body: source,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-nakafa-content-token": env.CONTENT_RUNTIME_TOKEN,
        },
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(RUNTIME_TIMEOUT_MILLISECONDS),
      }),
  });
  const decoded = yield* readRuntimeResponse(response, endpoint);

  return {
    request,
    response: decoded,
    status: response.status,
  } satisfies ContentRuntimeExchange;
});
