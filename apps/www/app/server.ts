import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import { answerProfileGate } from "@/lib/profile/gate";
import {
  readMigrationResponse,
  readRedirectResponse,
} from "@/lib/routing/redirect";
import { answerSchoolGate, withPageHeaders } from "@/lib/tenant/gate";

const startHandler = createStartHandler(defaultStreamHandler);

/** An error that escaped the Start request handler, kept with its original cause. */
class UncaughtRequestError extends Schema.TaggedError<UncaughtRequestError>()(
  "UncaughtRequestError",
  { cause: Schema.Unknown }
) {}

/**
 * Start's server entry. The address alone decides each answer, in this order: a
 * retired public address moves to its successor, a redirect of the locale or
 * the path answers, and a gate answers a school tree path of a main host and a
 * raw user address that is no profile with not found. Only then does the router
 * see the request, and every page and not-found answer carries the page headers
 * (ADR 0026). Route errors are handled by the router. Only an error that escapes
 * the handler or a migration reaches the catch, which reports it and answers with
 * Start's error response.
 *
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 */
export default createServerEntry({
  fetch(request, opts) {
    return Effect.runPromise(
      Effect.gen(function* () {
        const migrated = yield* readMigrationResponse(request).pipe(
          Effect.mapError((cause) => new UncaughtRequestError({ cause }))
        );
        if (Option.isSome(migrated)) {
          return migrated.value;
        }
        const redirect = readRedirectResponse(request);
        if (Option.isSome(redirect)) {
          return redirect.value;
        }
        const gated = Option.orElse(answerSchoolGate(request), () =>
          answerProfileGate(request)
        );
        if (Option.isSome(gated)) {
          return gated.value;
        }
        return yield* Effect.tryPromise({
          try: async () => startHandler(request, opts),
          catch: (cause) => new UncaughtRequestError({ cause }),
        });
      }).pipe(
        Effect.catchTag("UncaughtRequestError", (error) =>
          reportUncaughtRequestError(error.cause, request).pipe(
            Effect.as(handleStartError(error.cause))
          )
        ),
        Effect.map((response) => withPageHeaders(request, response))
      )
    );
  },
});
