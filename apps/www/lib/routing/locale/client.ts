"use client";
import { useRouter } from "@repo/internationalization/src/navigation";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { Locale } from "next-intl";
import { useTransition } from "react";

/** Raised when the browser language switch cannot resolve a route-owned href. */
class LocalizedHrefClientError extends Data.TaggedError(
  "LocalizedHrefClientError"
)<{
  message: string;
}> {}
const LocalizedHrefResponseSchema = Schema.Struct({
  href: Schema.String,
});
/** Reads the browser location without keeping stale React state around. */
function readCurrentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
/**
 * Calls the internal route-localization endpoint from a browser event and
 * decodes the JSON contract before the caller hands it to `router.replace`.
 */
const readLocalizedHref = Effect.fn("www.routing.locale.client.read")(
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
          (cause) => new LocalizedHrefClientError({ message: String(cause) })
        )
      );
  }
);
/**
 * Drives locale switches through the route-owned localization API instead of
 * preserving localized slug text across languages.
 */
export function useLocalizedRouteSwitch() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function replace(locale: Locale) {
    startTransition(() => {
      Effect.runPromise(
        readLocalizedHref({ href: readCurrentHref(), locale }).pipe(
          Effect.tap(({ href }) =>
            Effect.sync(() => {
              router.replace(href, { locale });
            })
          ),
          Effect.catch(() => Effect.void),
          Effect.provide(FetchClient)
        )
      );
    });
  }
  return { isPending, replace };
}
