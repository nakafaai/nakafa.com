import type { ProtectedContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type {
  ContentRuntimeFailureSchema,
  ContentRuntimeMissingSchema,
} from "@nakafa/aksara-contracts/runtime/result";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
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
import { parseContentLength, readBoundedStream } from "@repo/utilities/body";
import { FetchClient } from "@repo/utilities/http/client";
import { isJsonContentType } from "@repo/utilities/mime";
import {
  Clock,
  Data,
  Effect,
  HashSet,
  Layer,
  Schedule,
  Schema,
  Stream,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

const CONTENT_TIMEOUT_MILLISECONDS = 10_000;
const LOOPBACK_HOSTS = HashSet.make("127.0.0.1", "[::1]", "localhost");
/** Reads and writes unknown JSON text; its bytes match JSON.parse and JSON.stringify. */
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);
/**
 * The Fetch client for the private runtime: never cached, never redirected,
 * and kept out of telemetry because every request carries the runtime
 * credential. Only the Fetch client honors those options, so this module
 * provides it instead of accepting any HTTP client.
 */
const ContentHttpClient = FetchClient.pipe(
  Layer.provide(
    Layer.merge(
      Layer.succeed(FetchHttpClient.RequestInit, {
        cache: "no-store",
        redirect: "error",
      }),
      Layer.succeed(HttpClient.TracerDisabledWhen, () => true)
    )
  )
);
type ContentRuntimeStatus =
  | Pick<typeof ContentRuntimeFailureSchema.Type, "code" | "kind">
  | Pick<PublicContentRuntimeFound | ProtectedContentRuntimeFound, "kind">
  | Pick<typeof ContentRuntimeMissingSchema.Type, "kind">;

const ContentHttpTargetSchema = Schema.Struct({
  siteUrl: Schema.String,
  token: Schema.String,
});
/** Server-owned connection values for private Convex content endpoints. */
export type ContentHttpTarget = typeof ContentHttpTargetSchema.Type;

/**
 * One exact unmarked response may share the safe read retry budget. It keeps
 * the deadline of the attempt that received it for a read after the budget.
 */
class RetryableContentResponse extends Data.TaggedError(
  "RetryableContentResponse"
)<{
  readonly deadline: number;
  readonly response: HttpClientResponse.HttpClientResponse;
}> {}

/** One received response failed while its bounded body stream was read. */
class RetryableContentBody extends Data.TaggedError("RetryableContentBody")<{
  readonly cause: ContentTransportError;
}> {}
/**
 * One request reached its deadline before Fetch answered. Fetch does not say
 * why, so this is kept apart from the unclassified network failures that stay
 * final.
 */
class RetryableContentDeadline extends Data.TaggedError(
  "RetryableContentDeadline"
) {}
type ContentRequestFailure =
  | NetworkRequestError
  | RetryableContentBody
  | RetryableContentDeadline
  | RetryableContentResponse;

/** Returns whether one failure is safe to retry as the same read request. */
function isRetryableContentFailure(
  error: unknown
): error is ContentRequestFailure {
  if (
    error instanceof RetryableContentBody ||
    error instanceof RetryableContentDeadline ||
    error instanceof RetryableContentResponse
  ) {
    return true;
  }
  return (
    Schema.is(NetworkRequestError)(error) && isRetryableNetworkError(error)
  );
}

/** Returns whether an exact unmarked JSON 500 is eligible for read retry. */
function isRetryableContentResponse(
  response: HttpClientResponse.HttpClientResponse,
  endpoint: string
) {
  return (
    response.url === endpoint &&
    response.status === 500 &&
    isJsonContentType(response.headers["content-type"] ?? null) &&
    response.headers[CONTENT_RUNTIME_RESPONSE_HEADER] === undefined
  );
}

/**
 * Releases only a response that the retry schedule will discard: opening its
 * body and closing it at once cancels the body and aborts the request.
 *
 * @see https://github.com/nodejs/undici/blob/v7.29.0/README.md#garbage-collection
 */
const cancelRetryResponse = Effect.fn("NakafaContent.cancelRetryResponse")(
  (failure: RetryableContentResponse) =>
    Effect.scoped(Stream.toPull(failure.response.stream))
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
  if (Schema.is(ContentTransportError)(failure) && failure.reason === "body") {
    return new RetryableContentBody({
      cause: failure,
    });
  }
  return failure;
}

/** Returns whether the response carries the current diagnostic marker. */
function hasContentRuntimeMarker(
  response: HttpClientResponse.HttpClientResponse
) {
  return (
    response.headers[CONTENT_RUNTIME_RESPONSE_HEADER] ===
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
}

/** Classifies an out-of-contract JSON body without exposing its contents. */
export function createContentContractError(
  response: HttpClientResponse.HttpClientResponse
) {
  if (hasContentRuntimeMarker(response)) {
    return new ContentTransportError({
      reason: "response-contract",
    });
  }
  return new ContentTransportError({
    reason: "response-unmarked",
  });
}

/** Classifies malformed JSON without exposing its response body. */
function createContentSyntaxError(
  response: HttpClientResponse.HttpClientResponse
) {
  if (hasContentRuntimeMarker(response)) {
    return new ContentTransportError({
      reason: "json-syntax",
    });
  }
  return new ContentTransportError({
    reason: "response-unmarked",
  });
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
    return yield* new ContentTransportError({
      reason: "status",
    });
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
  return yield* new ContentTransportError({
    reason: "status",
  });
});

/** Builds one fixed private endpoint without inheriting paths or credentials. */
export const createContentEndpoint = Effect.fn(
  "NakafaContent.createContentEndpoint"
)(function* (baseUrl: string, path: string) {
  const base = yield* Effect.try({
    catch: () =>
      new ContentTransportError({
        reason: "url",
      }),
    try: () => new URL(baseUrl),
  });
  const isLocalHttp =
    base.protocol === "http:" && HashSet.has(LOOPBACK_HOSTS, base.hostname);
  if (
    (base.protocol !== "https:" && !isLocalHttp) ||
    base.username.length + base.password.length > 0
  ) {
    return yield* new ContentTransportError({
      reason: "url",
    });
  }
  return new URL(path, base.origin).href;
});

/** Serializes one request while enforcing its complete UTF-8 byte ceiling. */
export const encodeContentRequest = Effect.fn(
  "NakafaContent.encodeContentRequest"
)(function* (input: unknown, maxBytes: number) {
  const source = yield* Schema.encodeEffect(JsonTextSchema)(input).pipe(
    Effect.mapError(
      () =>
        new ContentTransportError({
          reason: "request",
        })
    )
  );
  if (new TextEncoder().encode(source).byteLength > maxBytes) {
    return yield* new ContentTransportError({
      reason: "request-size",
    });
  }
  return source;
});

/**
 * Keeps only the sanitized retry classification of one failed request: the
 * rejection Fetch raised, which is the cause of the client's transport failure.
 */
function toNetworkRequestError(error: HttpClientError.HttpClientError) {
  return createNetworkRequestError(error.reason.cause);
}

/**
 * Requests and reads one response with the server-owned runtime capability.
 *
 * The runtime action is read-only. Allowlisted network failures, a request that
 * misses its deadline, an interrupted response body, and the exact unmarked
 * JSON 500 that the pinned Convex backend creates when Nakafa does not complete
 * the action share two bounded retries. Unclassified network failures end the
 * read without retry. Every other response or reader failure continues without
 * retry into the exact status, response, and signature checks. One attempt, from
 * its request to the end of its body, has one ten second deadline. A read
 * therefore answers or fails within 31.5 seconds: three attempts with the 500 ms
 * and 1 s retry delays between them. Decoding and verifying the answer come
 * after that.
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
    response: HttpClientResponse.HttpClientResponse,
    endpoint: string
  ) => Effect.Effect<Value, Failure, Requirements>
) {
  const client = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.post(input.endpoint).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.setHeader("x-nakafa-content-token", input.target.token),
    HttpClientRequest.bodyText(input.source, "application/json")
  );
  /** Reads one response until the deadline of the attempt that received it. */
  const readUntil = (
    response: HttpClientResponse.HttpClientResponse,
    deadline: number
  ) =>
    Effect.gen(function* () {
      const remaining = deadline - (yield* Clock.currentTimeMillis);
      return yield* read(response, input.endpoint).pipe(
        Effect.timeoutOrElse({
          duration: Math.max(remaining, 0),
          orElse: () =>
            Effect.fail(new ContentTransportError({ reason: "body" })),
        })
      );
    });
  const attempt = Effect.gen(function* () {
    const deadline =
      (yield* Clock.currentTimeMillis) + CONTENT_TIMEOUT_MILLISECONDS;
    const response = yield* client.execute(request).pipe(
      Effect.mapError(toNetworkRequestError),
      Effect.timeoutOrElse({
        duration: CONTENT_TIMEOUT_MILLISECONDS,
        orElse: () => Effect.fail(new RetryableContentDeadline()),
      }),
      Effect.filterOrFail(
        (received) => !isRetryableContentResponse(received, input.endpoint),
        (received) =>
          new RetryableContentResponse({
            deadline,
            response: received,
          })
      )
    );
    const value = yield* readUntil(response, deadline).pipe(
      Effect.mapError(classifyContentBodyFailure)
    );
    return {
      response,
      value,
    };
  });
  return yield* attempt.pipe(
    Effect.retry(CONTENT_RETRY_SCHEDULE),
    Effect.catchIf(
      (failure): failure is RetryableContentResponse =>
        failure instanceof RetryableContentResponse,
      (failure) =>
        readUntil(failure.response, failure.deadline).pipe(
          Effect.map((value) => ({
            response: failure.response,
            value,
          }))
        )
    ),
    Effect.catchIf(
      (failure): failure is RetryableContentBody =>
        failure instanceof RetryableContentBody,
      (failure) => Effect.fail(failure.cause)
    ),
    Effect.catchIf(
      (failure): failure is RetryableContentDeadline =>
        failure instanceof RetryableContentDeadline,
      () =>
        Effect.fail(
          new ContentTransportError({
            networkCodes: [],
            reason: "fetch",
          })
        )
    ),
    Effect.catchIf(
      (failure): failure is NetworkRequestError =>
        Schema.is(NetworkRequestError)(failure),
      (failure) =>
        Effect.fail(
          new ContentTransportError({
            networkCodes: failure.networkCodes,
            reason: "fetch",
          })
        )
    )
  );
}, Effect.provide(ContentHttpClient));

/** Reads one private JSON response without trusting advertised byte counts. */
export const readContentResponse = Effect.fn(
  "NakafaContent.readContentResponse"
)(function* (
  response: HttpClientResponse.HttpClientResponse,
  endpoint: string,
  maxBytes: number
) {
  if (response.url !== endpoint) {
    return yield* new ContentTransportError({
      reason: "response-url",
    });
  }
  if (!isJsonContentType(response.headers["content-type"] ?? null)) {
    return yield* new ContentTransportError({
      reason: "content-type",
    });
  }
  yield* parseContentLength(
    response.headers["content-length"] ?? null,
    maxBytes
  ).pipe(
    Effect.mapError(
      () =>
        new ContentTransportError({
          reason: "content-length",
        })
    )
  );
  const bytes = yield* readBoundedStream(response.stream, maxBytes).pipe(
    Effect.mapError(
      (error) =>
        new ContentTransportError({
          reason: error._tag === "BodyLimitError" ? "response-size" : "body",
        })
    )
  );
  const source = yield* Effect.try({
    catch: () =>
      new ContentTransportError({
        reason: "body",
      }),
    try: () =>
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes),
  });
  return yield* Schema.decodeEffect(JsonTextSchema)(source).pipe(
    Effect.mapError(() => createContentSyntaxError(response))
  );
});
