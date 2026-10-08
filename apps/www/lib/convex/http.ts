import type { AnyPublicQuery, OptionalArgs } from "@confect/core/Ref";
import { HttpClient } from "@confect/js";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_ATTEMPT_DEADLINE,
  NETWORK_RETRY_SCHEDULE,
} from "@repo/backend/client/network";
import { Data, Effect, Layer, Result, Schema } from "effect";
import { env } from "@/env";

type HttpClientOptions = Parameters<typeof HttpClient.layer>[1];

/**
 * Convex HTTP API failures for a query Convex refused before running it: the
 * deployment's concurrency queue expired, or the service was briefly
 * unavailable. `ConvexHttpClient` throws the response body as the message.
 *
 * @see https://docs.convex.dev/production/state/limits
 */
const RefusedQuery = Schema.fromJsonString(
  Schema.Struct({
    code: Schema.Literals(["ExpiredInQueue", "ServiceUnavailable"]),
  })
);

/**
 * One attempt of a query that Convex did not answer within its deadline. It is
 * the cause of the client's own error, so the retry policy treats it like any
 * other transient failure.
 */
class QueryDeadline extends Data.TaggedError("QueryDeadline") {}

/**
 * Whether repeating a query is safe: Convex queries only read, and this
 * failure either happened before Convex ran the query, or the attempt missed
 * its deadline, or the connection dropped before Convex answered. Function
 * errors and decoding failures are never transient.
 */
function isTransientQueryFailure(error: unknown) {
  if (!Schema.is(HttpClient.HttpClientError)(error)) {
    return false;
  }
  const { cause } = error;
  if (cause instanceof QueryDeadline) {
    return true;
  }
  if (
    cause instanceof Error &&
    Result.isSuccess(Schema.decodeResult(RefusedQuery)(cause.message))
  ) {
    return true;
  }
  return isRetryableNetworkError(createNetworkRequestError(cause));
}

/**
 * Makes the provided client retry transient query failures, and gives each
 * attempt its own deadline so a stalled query fails within its retry budget.
 * Mutations and actions are not idempotent, so they pass through unchanged.
 * The export lets the tests script the base client under the test clock, which
 * httpLayer does not allow.
 *
 * The budget is per query. A cached function that makes one Convex query and
 * then one protected content read, such as the featured try-out, can take about
 * 63 seconds. Next.js stops a cache fill at 54 seconds (see
 * next/dist/server/use-cache/use-cache-wrapper.js), so that attempt fails there,
 * and the page's retry (`staticGenerationRetryCount`) runs it again.
 */
export const withQueryRetry = <E, R>(
  base: Layer.Layer<HttpClient.HttpClient, E, R>
) =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) => ({
      ...client,
      query: <Query extends AnyPublicQuery>(
        ref: Query,
        ...rest: OptionalArgs<Query>
      ) =>
        client.query(ref, ...rest).pipe(
          Effect.timeoutOrElse({
            duration: NETWORK_ATTEMPT_DEADLINE,
            orElse: () =>
              Effect.fail(
                new HttpClient.HttpClientError({ cause: new QueryDeadline() })
              ),
          }),
          Effect.retry({
            schedule: NETWORK_RETRY_SCHEDULE,
            while: isTransientQueryFailure,
          }),
          Effect.tapError((error) =>
            isTransientQueryFailure(error)
              ? Effect.logWarning("A Convex query failed after its retries.")
              : Effect.void
          )
        ),
    }))
  ).pipe(Layer.provide(base));

/** Provides the Convex HTTP client for this deployment with query retries. */
export function httpLayer(options?: HttpClientOptions) {
  return withQueryRetry(
    options === undefined
      ? HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)
      : HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL, options)
  );
}
