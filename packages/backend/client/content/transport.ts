import "server-only";

import type { ProtectedContentRuntimeResponse } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { PublicContentRuntimeResponse } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
} from "@repo/backend/content/endpoint";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect } from "effect";

const CONTENT_TIMEOUT_MILLISECONDS = 10_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

type ContentRuntimeResponse =
  | ProtectedContentRuntimeResponse
  | PublicContentRuntimeResponse;
type ContentRuntimeStatus =
  | Pick<
      Extract<ContentRuntimeResponse, { readonly kind: "failure" }>,
      "code" | "kind"
    >
  | Pick<Extract<ContentRuntimeResponse, { readonly kind: "found" }>, "kind">
  | Pick<Extract<ContentRuntimeResponse, { readonly kind: "missing" }>, "kind">;

/** Server-owned connection values for private Convex content endpoints. */
export interface ContentHttpTarget {
  readonly siteUrl: string;
  readonly token: string;
}

/** Returns whether the response carries the current diagnostic marker. */
function hasContentRuntimeMarker(response: Response) {
  return (
    response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER) ===
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
}

/** Classifies an out-of-contract JSON body without exposing its contents. */
export function createContentContractError(response: Response) {
  if (hasContentRuntimeMarker(response)) {
    return new ContentTransportError({ reason: "response-contract" });
  }
  return new ContentTransportError({ reason: "response-unmarked" });
}

/** Classifies malformed JSON without exposing its response body. */
function createContentSyntaxError(response: Response) {
  if (hasContentRuntimeMarker(response)) {
    return new ContentTransportError({ reason: "json-syntax" });
  }
  return new ContentTransportError({ reason: "response-unmarked" });
}

/** Enforces the runtime endpoints' shared response and HTTP status pairs. */
export const validateContentRuntimeStatus = Effect.fn(
  "NakafaContent.validateContentRuntimeStatus"
)(function* (response: ContentRuntimeStatus, status: number) {
  if (response.kind === "found" && status === 200) {
    return;
  }
  if (response.kind === "missing" && status === 404) {
    return;
  }
  if (response.kind !== "failure") {
    return yield* new ContentTransportError({ reason: "status" });
  }
  if (response.code === "CONTENT_RUNTIME_UNAUTHORIZED" && status === 401) {
    return;
  }
  if (
    response.code === "CONTENT_RUNTIME_INVALID" &&
    (status === 400 || status === 413 || status === 415)
  ) {
    return;
  }
  if (
    (response.code === "CONTENT_RUNTIME_INTERNAL" ||
      response.code === "CONTENT_RUNTIME_RESPONSE_TOO_LARGE") &&
    status === 500
  ) {
    return;
  }
  return yield* new ContentTransportError({ reason: "status" });
});

/** Builds one fixed private endpoint without inheriting paths or credentials. */
export const createContentEndpoint = Effect.fn(
  "NakafaContent.createContentEndpoint"
)(function* (baseUrl: string, path: string) {
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

  return new URL(path, base.origin).href;
});

/** Serializes one request while enforcing its complete UTF-8 byte ceiling. */
export const encodeContentRequest = Effect.fn(
  "NakafaContent.encodeContentRequest"
)(function* (input: unknown, maxBytes: number) {
  const source = yield* Effect.try({
    catch: () => new ContentTransportError({ reason: "request" }),
    try: () => JSON.stringify(input),
  });
  if (source === undefined) {
    return yield* new ContentTransportError({ reason: "request" });
  }
  if (new TextEncoder().encode(source).byteLength > maxBytes) {
    return yield* new ContentTransportError({ reason: "request-size" });
  }

  return source;
});

/** Posts one no-store request with the server-owned runtime capability. */
export const postContentRequest = Effect.fn("NakafaContent.postContentRequest")(
  function* (input: {
    readonly endpoint: string;
    readonly source: string;
    readonly target: ContentHttpTarget;
  }) {
    return yield* Effect.tryPromise({
      catch: () => new ContentTransportError({ reason: "fetch" }),
      try: () =>
        fetch(input.endpoint, {
          body: input.source,
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-nakafa-content-token": input.target.token,
          },
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(CONTENT_TIMEOUT_MILLISECONDS),
        }),
    });
  }
);

/** Reads one private JSON response without trusting advertised byte counts. */
export const readContentResponse = Effect.fn(
  "NakafaContent.readContentResponse"
)(function* (response: Response, endpoint: string, maxBytes: number) {
  if (response.url !== endpoint) {
    return yield* new ContentTransportError({ reason: "response-url" });
  }
  if (!isJsonContentType(response.headers.get("content-type"))) {
    return yield* new ContentTransportError({ reason: "content-type" });
  }
  yield* parseContentLength(
    response.headers.get("content-length"),
    maxBytes
  ).pipe(
    Effect.mapError(
      () => new ContentTransportError({ reason: "content-length" })
    )
  );
  const bytes = yield* readBoundedBody(response.body, maxBytes).pipe(
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
  return yield* Effect.try({
    catch: () => createContentSyntaxError(response),
    try: (): unknown => JSON.parse(source),
  });
});
