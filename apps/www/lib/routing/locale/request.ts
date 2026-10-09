import {
  classifyNetworkFailure,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect, Schema } from "effect";
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
 * Calls the internal route-localization endpoint and decodes the JSON contract
 * before the caller hands it to `router.replace`. A missed deadline or a
 * retryable network failure is tried again on the shared schedule.
 *
 * The browser imports this module when a visitor picks a language, and the
 * module provides its own client, so no page ships the HTTP client in its
 * first JavaScript.
 */
export const requestLocalizedHref = Effect.fn("www.routing.locale.request")(
  function* ({ href, locale }: { href: string; locale: Locale }) {
    return yield* retryNetworkAttempt(
      attemptLocalizedHref(href, locale),
      new LocalizedHrefRequestError({
        message: "The route-localization request timed out.",
      })
    );
  },
  Effect.provide(FetchClient)
);
