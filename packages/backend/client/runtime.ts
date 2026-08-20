import {
  createNetworkRequestError,
  NETWORK_RETRY_DELAYS_MILLISECONDS,
  NetworkRequestError,
  NetworkRetryCodeSchema,
} from "@repo/backend/client/network";
import { ConvexHttpClient } from "convex/browser";
import {
  type FunctionArgs,
  type FunctionReference,
  getFunctionName,
} from "convex/server";
import { Effect, Schedule, Schema } from "effect";

const CONVEX_QUERY_RETRY_SCHEDULE = Schedule.recurs(2).pipe(
  Schedule.addDelay(({ attempt }) =>
    Effect.succeed(
      attempt === 1
        ? NETWORK_RETRY_DELAYS_MILLISECONDS[0]
        : NETWORK_RETRY_DELAYS_MILLISECONDS[1]
    )
  )
);

/** One public Convex query failed at a sanitized client boundary. */
export class ConvexRuntimeQueryError extends Schema.TaggedError<ConvexRuntimeQueryError>()(
  "ConvexRuntimeQueryError",
  {
    networkCodes: Schema.Array(NetworkRetryCodeSchema),
    query: Schema.String,
    reason: Schema.Literals(["client", "query", "transport"]),
  }
) {
  get message() {
    return createQueryMessage(this.query, this.reason, this.networkCodes);
  }
}

function createQueryMessage(
  query: string,
  reason: ConvexRuntimeQueryError["reason"],
  networkCodes: ConvexRuntimeQueryError["networkCodes"]
) {
  const codeSuffix =
    networkCodes.length > 0 ? ` Codes: ${networkCodes.join(", ")}.` : "";
  return `Convex runtime query ${query} failed at the ${reason} boundary.${codeSuffix}`;
}

function createRuntimeQueryError(
  query: string,
  reason: ConvexRuntimeQueryError["reason"],
  networkCodes: ConvexRuntimeQueryError["networkCodes"] = []
) {
  return new ConvexRuntimeQueryError({
    networkCodes,
    query,
    reason,
  });
}

function mapQueryFailure(query: string, cause: unknown) {
  if (cause instanceof NetworkRequestError) {
    return createRuntimeQueryError(query, "transport", cause.networkCodes);
  }
  return createRuntimeQueryError(query, "query");
}

function isRetryableQueryError(error: ConvexRuntimeQueryError) {
  return error.reason === "transport" && error.networkCodes.length > 0;
}

/**
 * Reads one public Convex query through the Effect error channel.
 *
 * Only allowlisted pre-response network failures receive the shared bounded
 * retry schedule. Convex function, HTTP, protocol, timeout, and unknown
 * failures remain terminal.
 *
 * @see https://docs.convex.dev/functions/error-handling/
 * @see https://effect.website/docs/error-management/retrying/
 */
export const readConvexRuntimeQuery = Effect.fn("ConvexRuntime.query")(
  function* <Query extends FunctionReference<"query">>(
    convexUrl: string,
    query: Query,
    args: FunctionArgs<Query>
  ) {
    const queryName = yield* Effect.try({
      catch: () => createRuntimeQueryError("unknown", "client"),
      try: () => getFunctionName(query),
    });
    const client = yield* Effect.try({
      catch: () => createRuntimeQueryError(queryName, "client"),
      try: () =>
        new ConvexHttpClient(convexUrl, {
          fetch: fetchNoStore,
          logger: false,
        }),
    });
    return yield* Effect.tryPromise({
      catch: (cause) => mapQueryFailure(queryName, cause),
      try: () => client.query(query, args),
    }).pipe(
      Effect.retry({
        schedule: CONVEX_QUERY_RETRY_SCHEDULE,
        while: isRetryableQueryError,
      })
    );
  }
);

/** Adapts the official client fetch hook to a sanitized network error. */
const fetchNoStore: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: "no-store",
  }).then(undefined, (cause) =>
    Promise.reject(createNetworkRequestError(cause))
  );
