import { createNetworkRequestError } from "@repo/backend/client/network";
import { Effect, Schema } from "effect";

const CONVEX_UDF_FAILED_STATUS = 560;

export const ConvexTransientStatusSchema = Schema.Int.check(
  Schema.isBetween({ maximum: 599, minimum: 500 }),
  Schema.makeFilter((status) => status !== CONVEX_UDF_FAILED_STATUS, {
    expected: "a transient Convex HTTP status",
  })
);

/** One retryable HTTP response from the Convex query endpoint. */
export class ConvexTransientResponseError extends Schema.TaggedError<ConvexTransientResponseError>()(
  "ConvexTransientResponseError",
  {
    status: ConvexTransientStatusSchema,
  }
) {}

/** Internal failure while releasing one transient response stream. */
class ConvexResponseCancelError extends Schema.TaggedError<ConvexResponseCancelError>()(
  "ConvexResponseCancelError",
  {
    cause: Schema.Unknown,
    status: ConvexTransientStatusSchema,
  }
) {}

function isTransientConvexResponse(response: Response) {
  return (
    response.status >= 500 &&
    response.status < 600 &&
    response.status !== CONVEX_UDF_FAILED_STATUS
  );
}

const cancelTransientResponse = Effect.fn(
  "ConvexRuntime.cancelTransientResponse"
)(function* (response: Response) {
  const body = response.body;
  if (!body) {
    return;
  }

  yield* Effect.tryPromise({
    try: () => body.cancel(),
    catch: (cause) =>
      new ConvexResponseCancelError({ cause, status: response.status }),
  }).pipe(
    Effect.catchTag("ConvexResponseCancelError", (error) =>
      Effect.logWarning(
        "Unable to cancel transient Convex response body."
      ).pipe(Effect.annotateLogs({ status: error.status }))
    )
  );
});

const readConvexResponse = Effect.fn("ConvexRuntime.response")(function* (
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const response = yield* Effect.tryPromise({
    catch: createNetworkRequestError,
    try: () =>
      fetch(input, {
        ...init,
        cache: "no-store",
      }),
  });
  if (isTransientConvexResponse(response)) {
    yield* cancelTransientResponse(response);
    return yield* new ConvexTransientResponseError({
      status: response.status,
    });
  }

  return response;
});

/** Adapts Effect to the official client's required Promise fetch boundary. */
export function createConvexRuntimeFetch(): typeof fetch {
  return (input, init) => Effect.runPromise(readConvexResponse(input, init));
}
