import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import { answerProfileGate } from "@/lib/profile/gate";
import { readRedirectResponse } from "@/lib/routing/redirect";
import { answerSchoolGate, withPageHeaders } from "@/lib/tenant/gate";

const startHandler = createStartHandler(defaultStreamHandler);

/** An error that escaped the Start request handler, kept with its original cause. */
class UncaughtRequestError extends Schema.TaggedError<UncaughtRequestError>()(
  "UncaughtRequestError",
  { cause: Schema.Unknown }
) {}

/**
 * Start's server entry. A redirect that the address alone decides answers
 * first. A school tree path on a main host, and a raw user address that is no
 * profile, then answer not found before the router sees them, and every school
 * page and not-found answer carries the page headers (ADR 0026). Route errors
 * are handled by the router. Only an error that escapes the handler reaches the
 * catch, which reports it and answers with Start's error response.
 *
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 */
export default createServerEntry({
  fetch(request, opts) {
    const redirect = readRedirectResponse(request);
    if (Option.isSome(redirect)) {
      return Promise.resolve(redirect.value);
    }
    const gated = Option.orElse(answerSchoolGate(request), () =>
      answerProfileGate(request)
    );
    if (Option.isSome(gated)) {
      return Promise.resolve(gated.value);
    }
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
    ).then((response) => withPageHeaders(request, response));
  },
});
