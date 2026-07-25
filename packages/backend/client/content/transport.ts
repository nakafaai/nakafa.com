import "server-only";

import { ContentTransportError } from "@repo/backend/client/content/errors";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect } from "effect";

const CONTENT_TIMEOUT_MILLISECONDS = 10_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

/** Server-owned connection values for private Convex content endpoints. */
export interface ContentHttpTarget {
  readonly siteUrl: string;
  readonly token: string;
}

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

/** Posts one no-store request with server and optional user authentication. */
export const postContentRequest = Effect.fn("NakafaContent.postContentRequest")(
  function* (input: {
    readonly endpoint: string;
    readonly source: string;
    readonly target: ContentHttpTarget;
    readonly userToken?: string;
  }) {
    return yield* Effect.tryPromise({
      catch: () => new ContentTransportError({ reason: "fetch" }),
      try: () =>
        fetch(input.endpoint, {
          body: input.source,
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...(input.userToken
              ? { Authorization: `Bearer ${input.userToken}` }
              : {}),
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
    catch: () => new ContentTransportError({ reason: "json" }),
    try: (): unknown => JSON.parse(source),
  });
});
