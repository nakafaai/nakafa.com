import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import { handleStartError } from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import type { NotFoundPage } from "@/lib/routing/not-found";

/**
 * The router's answer to one request, which may fail with the error Start throws.
 * A request that the server answers not found names its not-found page, which
 * the router reads from its server context.
 */
export type RouterHandler = (
  request: Request,
  notFound: Option.Option<NotFoundPage>
) => Promise<Response>;

/** An error that escaped a decision of the server entry, kept with its original cause. */
export class UncaughtRequestError extends Schema.TaggedError<UncaughtRequestError>()(
  "UncaughtRequestError",
  { cause: Schema.Unknown }
) {}

/**
 * Routes one request to the router. A failure that escapes the router is
 * reported here and answered with Start's error response, so the router's answer
 * handles its own failures before the response leaves the decision chain.
 */
export const answerRouted = Effect.fn("www.routing.answer.routed")(function* (
  request: Request,
  route: RouterHandler,
  notFound: Option.Option<NotFoundPage> = Option.none()
) {
  return yield* Effect.tryPromise({
    try: () => route(request, notFound),
    catch: (cause) => new UncaughtRequestError({ cause }),
  }).pipe(
    Effect.catchTag("UncaughtRequestError", (error) =>
      reportUncaughtRequestError(error.cause, request).pipe(
        Effect.as(handleStartError(error.cause))
      )
    )
  );
});
