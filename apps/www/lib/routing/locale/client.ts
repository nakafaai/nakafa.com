"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { Data, Effect, Schema } from "effect";
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
    const url = new URL("/api/internal/routing/locale", window.location.origin);
    url.searchParams.set("href", href);
    url.searchParams.set("locale", locale);

    const response = yield* Effect.tryPromise({
      catch: (cause) =>
        new LocalizedHrefClientError({ message: String(cause) }),
      try: () =>
        fetch(url, {
          headers: { accept: "application/json" },
        }),
    });

    if (!response.ok) {
      return yield* new LocalizedHrefClientError({
        message: `Locale route lookup failed with ${response.status}`,
      });
    }

    const responseText = yield* Effect.tryPromise({
      catch: (cause) =>
        new LocalizedHrefClientError({ message: String(cause) }),
      try: () => response.text(),
    });
    const body = yield* Effect.try({
      catch: (cause) =>
        new LocalizedHrefClientError({ message: String(cause) }),
      try: () => {
        const value: unknown = JSON.parse(responseText);
        return value;
      },
    });

    return yield* Schema.decodeUnknown(LocalizedHrefResponseSchema)(body).pipe(
      Effect.mapError(
        (error) => new LocalizedHrefClientError({ message: String(error) })
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
          Effect.catchAll(() => Effect.void)
        )
      );
    });
  }

  return { isPending, replace };
}
