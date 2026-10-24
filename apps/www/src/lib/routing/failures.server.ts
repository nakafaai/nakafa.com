import { Array as Arr, Effect, Schema } from "effect";

const RouteMatchFactsSchema = Schema.Struct({
  error: Schema.Unknown,
  routeId: Schema.String,
  status: Schema.String,
});

/** The fields of one loaded route match that the failure log reads. */
export type RouteMatchFacts = typeof RouteMatchFactsSchema.Type;

/**
 * Logs every route that failed while the server loaded it. TanStack answers such
 * a route inside the router with its error page, so the request's error handler
 * never sees the cause. The log names the route and keeps the error, in every
 * environment, so a failure is visible wherever the Worker runs.
 */
export const logRouteFailures = Effect.fn("www.routing.logRouteFailures")(
  function* (matches: readonly RouteMatchFacts[]) {
    const failed = Arr.filter(matches, (match) => match.status === "error");
    yield* Effect.forEach(failed, (match) =>
      Effect.logError(
        "A route failed while the server loaded it.",
        match.routeId,
        match.error
      )
    );
  }
);
