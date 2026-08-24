import "server-only";

import type { ProtectedContentRuntimeResponse } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { PublicContentRuntimeResponse } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_RETRY_DELAYS_MILLISECONDS,
  NetworkRequestError,
} from "@repo/backend/client/network";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
} from "@repo/backend/content/endpoint";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Data, Effect, Schedule } from "effect";

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

/** One exact unmarked response may share the safe read retry budget. */
class RetryableContentResponse extends Data.TaggedError(
  "RetryableContentResponse"
)<{
  readonly response: Response;
}> {}

/** One received response failed while its bounded body stream was read. */
class RetryableContentBody extends Data.TaggedError("RetryableContentBody")<{
  readonly cause: ContentTransportError;
}> {}

type ContentRequestFailure =
  | NetworkRequestError
  | RetryableContentBody
  | RetryableContentResponse;

/** Returns whether one failure is safe to retry as the same read request. */
function isRetryableContentFailure(
  error: unknown
): error is ContentRequestFailure {
  if (
    error instanceof RetryableContentBody ||
    error instanceof RetryableContentResponse
  ) {
    return true;
  }
  return error instanceof NetworkRequestError && isRetryableNetworkError(error);
}

/** Returns whether an exact unmarked JSON 500 is eligible for read retry. */
function isRetryableContentResponse(response: Response, endpoint: string) {
  return (
    response.url === endpoint &&
    response.status === 500 &&
    isJsonContentType(response.headers.get("content-type")) &&
    response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER) === null
  );
}

/**
 * Releases only a response that the retry schedule will discard.
 *
 * @see https://github.com/nodejs/undici/blob/v7.29.0/README.md#garbage-collection
 */
const cancelRetryResponse = Effect.fn("NakafaContent.cancelRetryResponse")(
  function* (failure: ContentRequestFailure) {
    if (failure._tag !== "RetryableContentResponse") {
      return;
    }
    const body = failure.response.body;
    if (body === null) {
      return;
    }

    yield* Effect.tryPromise({
      catch: () => undefined,
      try: () => body.cancel(),
    }).pipe(
      Effect.catch(() =>
        Effect.logWarning(
          "Unable to cancel a discarded content runtime response body."
        )
      )
    );
  }
);

const CONTENT_RETRY_SCHEDULE: Schedule.Schedule<number, unknown> =
  Schedule.recurs(2).pipe(
    Schedule.addDelay(({ attempt }) =>
      Effect.succeed(
        attempt === 1
          ? NETWORK_RETRY_DELAYS_MILLISECONDS[0]
          : NETWORK_RETRY_DELAYS_MILLISECONDS[1]
      )
    ),
    Schedule.while(({ input }: Schedule.Metadata<number, unknown>) =>
      isRetryableContentFailure(input)
    ),
    Schedule.tap(({ input }) =>
      input instanceof RetryableContentResponse
        ? cancelRetryResponse(input)
        : Effect.void
    )
  );

/** Preserves terminal reader failures and marks only interrupted bodies retryable. */
function classifyContentBodyFailure<Failure>(failure: Failure) {
  if (failure instanceof ContentTransportError && failure.reason === "body") {
    return new RetryableContentBody({ cause: failure });
  }
  return failure;
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

/**
 * Requests and reads one response with the server-owned runtime capability.
 *
 * The runtime action is read-only. Allowlisted network failures and the exact
 * unmarked JSON 500 that the pinned Convex backend creates when Nakafa does not
 * complete the action share two bounded retries with an interrupted response
 * body. Every other HTTP response and reader failure continues without retry
 * into the exact status, response, and signature checks.
 *
 * @see https://docs.convex.dev/functions/http-actions
 * @see https://github.com/get-convex/convex-backend/blob/38abb46277140838cc5cdad59c6e85ad0432fc9a/crates/application/src/redaction.rs#L143-L160
 * @see https://effect.website/docs/error-management/retrying/
 */
export const requestContentResponse = Effect.fn(
  "NakafaContent.requestContentResponse"
)(function* <Value, Failure, Requirements>(
  input: {
    readonly endpoint: string;
    readonly source: string;
    readonly target: ContentHttpTarget;
  },
  read: (
    response: Response,
    endpoint: string
  ) => Effect.Effect<Value, Failure, Requirements>
) {
  const attempt = Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      catch: createNetworkRequestError,
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
    }).pipe(
      Effect.flatMap((response) => {
        if (!isRetryableContentResponse(response, input.endpoint)) {
          return Effect.succeed(response);
        }
        return Effect.fail(new RetryableContentResponse({ response }));
      })
    );
    const value = yield* read(response, input.endpoint).pipe(
      Effect.mapError(classifyContentBodyFailure)
    );
    return { response, value };
  });

  return yield* attempt.pipe(
    Effect.retry(CONTENT_RETRY_SCHEDULE),
    Effect.catchIf(
      (failure): failure is RetryableContentResponse =>
        failure instanceof RetryableContentResponse,
      (failure) =>
        read(failure.response, input.endpoint).pipe(
          Effect.map((value) => ({ response: failure.response, value }))
        )
    ),
    Effect.catchIf(
      (failure): failure is RetryableContentBody =>
        failure instanceof RetryableContentBody,
      (failure) => Effect.fail(failure.cause)
    ),
    Effect.catchIf(
      (failure): failure is NetworkRequestError =>
        failure instanceof NetworkRequestError,
      (failure) =>
        Effect.fail(
          new ContentTransportError({
            networkCodes: failure.networkCodes,
            reason: "fetch",
          })
        )
    )
  );
});

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
