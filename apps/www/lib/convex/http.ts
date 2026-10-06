import type { AnyPublicQuery, OptionalArgs } from "@confect/core/Ref";
import { HttpClient } from "@confect/js";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_RETRY_DELAYS_MILLISECONDS,
} from "@repo/backend/client/network";
import { Effect, Layer, Result, Schedule, Schema } from "effect";
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

/** Two retries after 500 ms and 1 s, the delays the content transport uses. */
const QUERY_RETRY_SCHEDULE = Schedule.recurs(2).pipe(
  Schedule.addDelay(({ attempt }) =>
    Effect.succeed(
      attempt === 1
        ? NETWORK_RETRY_DELAYS_MILLISECONDS[0]
        : NETWORK_RETRY_DELAYS_MILLISECONDS[1]
    )
  )
);

/**
 * Whether a query failed before Convex ran it, so repeating it is safe: a
 * refused request, or a connection that dropped before Convex answered.
 * Function errors and decoding failures are never transient.
 */
export function isTransientQueryFailure(error: unknown) {
  if (!Schema.is(HttpClient.HttpClientError)(error)) {
    return false;
  }
  const { cause } = error;
  if (
    cause instanceof Error &&
    Result.isSuccess(Schema.decodeResult(RefusedQuery)(cause.message))
  ) {
    return true;
  }
  return isRetryableNetworkError(createNetworkRequestError(cause));
}

/**
 * Makes the provided client retry transient query failures. Mutations and
 * actions are not idempotent, so they pass through unchanged.
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
          Effect.retry({
            schedule: QUERY_RETRY_SCHEDULE,
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
