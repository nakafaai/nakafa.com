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
 * Calls the internal route-localization endpoint and decodes the JSON contract
 * before the caller hands it to `router.replace`.
 *
 * The browser imports this module when a visitor picks a language, and the
 * module provides its own client, so no page ships the HTTP client in its
 * first JavaScript.
 */
export const requestLocalizedHref = Effect.fn("www.routing.locale.request")(
  function* ({ href, locale }: { href: string; locale: Locale }) {
    const client = yield* HttpClient.HttpClient;
    return yield* client
      .get("/api/internal/routing/locale", {
        acceptJson: true,
        urlParams: { href, locale },
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(LocalizedHrefResponseSchema)
        ),
        Effect.mapError(
          (cause) => new LocalizedHrefRequestError({ message: String(cause) })
        )
      );
  },
  Effect.provide(FetchClient)
);
