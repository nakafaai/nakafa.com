import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect } from "effect";

const startHandler = createStartHandler(defaultStreamHandler);

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
        try: () => startHandler(request, opts),
        catch: (cause) => cause,
      }).pipe(
        Effect.catch((error) =>
          reportUncaughtRequestError(error, request).pipe(
            Effect.as(handleStartError(error))
          )
        )
      )
    );
  },
});
