import {
  createNetworkRequestError,
  NETWORK_RETRY_DELAYS_MILLISECONDS,
  NetworkRequestError,
  NetworkRetryCodeSchema,
} from "@repo/backend/client/network";
import {
  ConvexTransientResponseError,
  ConvexTransientStatusSchema,
  createConvexRuntimeFetch,
} from "@repo/backend/client/response";
import { ConvexHttpClient } from "convex/browser";
import {
  type FunctionArgs,
  type FunctionReference,
  getFunctionName,
} from "convex/server";
import { Effect, Random, Schedule, Schema } from "effect";

const CONVEX_QUERY_RETRY_SCHEDULE = Schedule.recurs(2).pipe(
  Schedule.addDelay(({ attempt }) =>
    Random.next.pipe(
      Effect.map(
        (random) =>
          random *
          (attempt === 1
            ? NETWORK_RETRY_DELAYS_MILLISECONDS[0]
            : NETWORK_RETRY_DELAYS_MILLISECONDS[1])
      )
    )
  )
);

/** One public Convex query failed at a sanitized client boundary. */
export class ConvexRuntimeQueryError extends Schema.TaggedError<ConvexRuntimeQueryError>()(
  "ConvexRuntimeQueryError",
  {
    httpStatuses: Schema.Array(ConvexTransientStatusSchema),
    networkCodes: Schema.Array(NetworkRetryCodeSchema),
    query: Schema.String,
    reason: Schema.Literals(["client", "query", "transport"]),
  }
) {
  get message() {
    return createQueryMessage(
      this.query,
      this.reason,
      this.networkCodes,
      this.httpStatuses
    );
  }
}

function createQueryMessage(
  query: string,
  reason: ConvexRuntimeQueryError["reason"],
  networkCodes: ConvexRuntimeQueryError["networkCodes"],
  httpStatuses: ConvexRuntimeQueryError["httpStatuses"]
) {
  const codeSuffix =
    networkCodes.length > 0 ? ` Codes: ${networkCodes.join(", ")}.` : "";
  const statusSuffix =
    httpStatuses.length > 0
      ? ` HTTP statuses: ${httpStatuses.join(", ")}.`
      : "";
  return `Convex runtime query ${query} failed at the ${reason} boundary.${codeSuffix}${statusSuffix}`;
}

function createRuntimeQueryError(
  query: string,
  reason: ConvexRuntimeQueryError["reason"],
  networkCodes: ConvexRuntimeQueryError["networkCodes"] = [],
  httpStatuses: ConvexRuntimeQueryError["httpStatuses"] = []
) {
  return new ConvexRuntimeQueryError({
    httpStatuses,
    networkCodes,
    query,
    reason,
  });
}

function mapQueryFailure(query: string, cause: unknown) {
  if (cause instanceof ConvexTransientResponseError) {
    return createRuntimeQueryError(query, "transport", [], [cause.status]);
  }

  if (cause instanceof NetworkRequestError) {
    return createRuntimeQueryError(query, "transport", cause.networkCodes);
  }

  const responseNetworkError = createNetworkRequestError(cause);
  if (responseNetworkError.networkCodes.length > 0) {
    return createRuntimeQueryError(
      query,
      "transport",
      responseNetworkError.networkCodes
    );
  }

  return createRuntimeQueryError(query, "query");
}

function isRetryableQueryError(error: ConvexRuntimeQueryError) {
  return (
    error.reason === "transport" &&
    (error.networkCodes.length > 0 || error.httpStatuses.length > 0)
  );
}

/**
 * Reads one public Convex query through the Effect error channel.
 *
 * Only allowlisted network failures receive the shared bounded retry schedule,
 * including response-stream failures surfaced by the official client. Convex
 * 5xx responses receive the same bounded retry because queries are read-only,
 * except status 560, which represents a real Convex function failure. Other
 * HTTP, protocol, timeout, and unknown failures remain terminal.
 *
 * @see https://docs.convex.dev/functions/error-handling/
 * @see https://effect.website/docs/error-management/retrying/
 * @see https://github.com/get-convex/convex-backend/blob/1733af03ab93405b061216510695de990c33f787/npm-packages/node-executor/src/syscalls.ts#L84-L91
 * @see https://github.com/nodejs/undici/blob/v7.29.0/lib/web/fetch/index.js#L2130-L2135
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
          fetch: createConvexRuntimeFetch(),
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
