"use client";

import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";

import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import { isActiveLocale } from "@/lib/i18n/active";

type SavePreferredTryoutArgs = Ref.Args<
  typeof refs.public.learningPreferences.mutations.setPreferredTryoutCountry
>;
type SavePreferredTryout = (
  args: SavePreferredTryoutArgs
) => InvokeReturn<
  typeof refs.public.learningPreferences.mutations.setPreferredTryoutCountry
>;
/** Expected failure when a background try-out preference save fails. */
class TryoutPreferenceSaveError extends Schema.TaggedError<TryoutPreferenceSaveError>()(
  "TryoutPreferenceSaveError",
  {
    cause: Schema.Unknown,
  }
) {}
/** Persists try-out country selection without blocking route navigation. */
export function saveTryoutPreference({
  countryKey,
  errorMessage,
  locale,
  setPreferredTryout,
  source,
}: {
  countryKey: string;
  errorMessage: string;
  locale: Locale;
  setPreferredTryout: SavePreferredTryout;
  source: string;
}) {
  if (!isActiveLocale(locale)) {
    return Effect.void;
  }
  return Effect.tryPromise({
    try: () =>
      setPreferredTryout({
        locale,
        preferredTryoutCountryKey: countryKey,
      }),
    catch: (cause) => new TryoutPreferenceSaveError({ cause }),
  }).pipe(
    Effect.flatMap(Effect.fromResult),
    Effect.mapError((cause) => new TryoutPreferenceSaveError({ cause })),
    Effect.catchTag("TryoutPreferenceSaveError", (error) =>
      reportClientException(error, { countryKey, source }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            toast.error(errorMessage, { position: "bottom-center" });
          })
        )
      )
    )
  );
}
