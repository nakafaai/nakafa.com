import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import type { Locale } from "@repo/internationalization/src/locale";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import { readProfileGate } from "@/lib/profile/gate";
import {
  createNotFoundRequest,
  withContentLanguage,
} from "@/lib/routing/not-found";
import {
  readMigrationResponse,
  readRedirectResponse,
} from "@/lib/routing/redirect";
import { readSchoolRefusal } from "@/lib/routing/school/refusal";
import { readSchoolTreeGate, withPageHeaders } from "@/lib/tenant/gate";

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
 * raw user address that is no profile with not found. A school page that its
 * school refuses answers not found before it streams (ADR 0026). Every not-found
 * answer is the app's own not-found page, rendered in the locale of the address
 * through the standalone page. Only then does the router see the request, and
 * every page and not-found answer carries the page headers. Route errors are
 * handled by the router. Only an error that escapes the handler or a migration
 * reaches the catch, which reports it and answers with Start's error response.
 *
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 */
export default createServerEntry({
  fetch(request, opts) {
    /** Renders the standalone not-found page in one locale, as the address of the request answers. */
    const answerNotFound = (locale: Locale) =>
      Effect.tryPromise({
        try: async () =>
          startHandler(createNotFoundRequest(request, locale), opts),
        catch: (cause) => new UncaughtRequestError({ cause }),
      }).pipe(Effect.map((response) => withContentLanguage(response, locale)));

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
        const gated = Option.orElse(readSchoolTreeGate(request), () =>
          readProfileGate(request)
        );
        if (Option.isSome(gated)) {
          return yield* answerNotFound(gated.value);
        }
        const refused = yield* readSchoolRefusal(request);
        if (Option.isSome(refused)) {
          return yield* answerNotFound(refused.value);
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
