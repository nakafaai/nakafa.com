import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

const startHandler = createStartHandler(defaultStreamHandler);

/** An error that escaped the Start request handler, kept with its original cause. */
class UncaughtRequestError extends Schema.TaggedError<UncaughtRequestError>()(
  "UncaughtRequestError",
  { cause: Schema.Unknown }
) {}

/**
 * Start's server entry. Route errors are handled by the router. Only an error
 * that escapes the handler reaches the catch, which reports it and answers with
 * Start's error response.
 *
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 */
export default createServerEntry({
  fetch(request, opts) {
    return Effect.runPromise(
      Effect.tryPromise({
        try: async () => startHandler(request, opts),
        catch: (cause) => new UncaughtRequestError({ cause }),
      }).pipe(
        Effect.catchTag("UncaughtRequestError", (error) =>
          reportUncaughtRequestError(error.cause, request).pipe(
            Effect.as(handleStartError(error.cause))
          )
        )
      )
    );
  },
});
