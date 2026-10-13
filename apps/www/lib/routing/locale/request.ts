import {
  classifyNetworkFailure,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect, Option, Schema, String as Str } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { Locale } from "next-intl";

/** Raised when the browser language switch cannot resolve a route-owned href. */
class LocalizedHrefRequestError extends Data.TaggedError(
  "LocalizedHrefRequestError"
)<{
  message: string;
}> {}

const LocalizedHrefResponseSchema = Schema.Struct({
  href: Schema.String,
});

/**
 * Sends one localization request and decodes its answer. The retry helper gives
 * the attempt its deadline, which covers the send, the status check, and the
 * body read, so a stalled request ends.
 */
const attemptLocalizedHref = Effect.fn("www.routing.locale.attempt")(function* (
  href: string,
  locale: Locale
) {
  const client = yield* HttpClient.HttpClient;
  return yield* client
    .get("/api/internal/routing/locale", {
      acceptJson: true,
      urlParams: { href, locale },
    })
    .pipe(
      // The rejected request keeps its retry class, never its message.
      Effect.mapError((error) =>
        classifyNetworkFailure(
          error.reason.cause,
          new LocalizedHrefRequestError({
            message: "The route-localization request could not be sent.",
          })
        )
      ),
      Effect.flatMap((response) =>
        HttpClientResponse.filterStatusOk(response).pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(LocalizedHrefResponseSchema)
          ),
          Effect.mapError(
            (cause) => new LocalizedHrefRequestError({ message: String(cause) })
          )
        )
      )
    );
});

/**
 * Splits `href` at its fragment, which is the part from the first `#`. A
 * fragment is state of the page that a browser sends to no server, and a share
 * link keeps its token there.
 */
function splitFragment(href: string) {
  return Option.match(Str.indexOf("#")(href), {
    onNone: () => ({ fragment: "", path: href }),
    onSome: (start) => ({
      fragment: Str.slice(start)(href),
      path: Str.slice(0, start)(href),
    }),
  });
}

/**
 * Calls the internal route-localization endpoint and decodes the JSON contract
 * before the caller hands it to `router.replace`. A missed deadline or a
 * retryable network failure is tried again on the shared schedule.
 *
 * The request carries the path and the query of `href` and never its fragment,
 * so a share token in the fragment reaches no server and no log. The answer
 * gets the fragment back, so the visitor stays where they were on the page.
 *
 * The browser imports this module when a visitor picks a language, and the
 * module provides its own client, so no page ships the HTTP client in its
 * first JavaScript.
 */
export const requestLocalizedHref = Effect.fn("www.routing.locale.request")(
  function* ({ href, locale }: { href: string; locale: Locale }) {
    const { fragment, path } = splitFragment(href);
    const localized = yield* retryNetworkAttempt(
      attemptLocalizedHref(path, locale),
      new LocalizedHrefRequestError({
        message: "The route-localization request timed out.",
      })
    );
    return { href: `${localized.href}${fragment}` };
  },
  Effect.provide(FetchClient)
);
