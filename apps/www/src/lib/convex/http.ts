import type { AnyPublicQuery, OptionalArgs } from "@confect/core/Ref";
import { HttpClient } from "@confect/js";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { Data, Effect, HashSet, Layer, Result, Schema } from "effect";
import { clientEnv } from "@/env.public";

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

/** The statuses of a gateway in front of Convex that could not reach it. */
const GATEWAY_STATUSES = HashSet.make(502, 503, 504);

/**
 * A gateway in front of Convex answered in Convex's place, so no function ran.
 * `ConvexHttpClient` throws an error status's body as the message, and a gateway
 * writes that body as it likes, so only the status can name this failure.
 */
export class ConvexGatewayFailure extends Data.TaggedError(
  "ConvexGatewayFailure"
)<{ readonly status: number }> {}

/** The fetch of a Convex HTTP client, which turns a gateway's answer into its failure. */
export const failAtGateway =
  (send: typeof fetch): typeof fetch =>
  (input, init) =>
    send(input, init).then((response) =>
      HashSet.has(GATEWAY_STATUSES, response.status)
        ? Promise.reject(new ConvexGatewayFailure({ status: response.status }))
        : response
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
 * its deadline, or a gateway or a dropped connection stood between it and Convex. Function
 * errors and decoding failures are never transient.
 */
function isTransientQueryFailure(error: unknown) {
  if (!Schema.is(HttpClient.HttpClientError)(error)) {
    return false;
  }
  const { cause } = error;
  if (cause instanceof QueryDeadline || cause instanceof ConvexGatewayFailure) {
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
 * 63 seconds. The framework stops a cache fill at 54 seconds (its use-cache
 * wrapper decides this), so that attempt fails there,
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
        retryNetworkAttempt(
          client.query(ref, ...rest).pipe(
            // Only a transient failure joins the shared retry schedule.
            Effect.mapError((error) =>
              isTransientQueryFailure(error)
                ? new RetryableNetworkAttempt({ failure: error })
                : error
            )
          ),
          new HttpClient.HttpClientError({ cause: new QueryDeadline() })
        ).pipe(
          Effect.tapError((error) =>
            isTransientQueryFailure(error)
              ? Effect.logWarning("A Convex query failed after its retries.")
              : Effect.void
          )
        ),
    }))
  ).pipe(Layer.provide(base));

/**
 * Provides the Convex HTTP client for this deployment with one attempt per
 * query. A caller that sets its own deadline and its own fallback, such as the
 * school gate of the proxy, does not repeat a failed read.
 */
export function httpSingleAttemptLayer(options?: HttpClientOptions) {
  return HttpClient.layer(clientEnv.VITE_CONVEX_URL, {
    ...options,
    fetch: failAtGateway(fetch),
  });
}

/** Provides the Convex HTTP client for this deployment with query retries. */
export function httpLayer(options?: HttpClientOptions) {
  return withQueryRetry(httpSingleAttemptLayer(options));
}
