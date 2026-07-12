"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

type SavePreferredTryoutArgs = FunctionArgs<
  typeof api.learningPreferences.mutations.setPreferredTryoutCountry
>;
type SavePreferredTryout = (
  args: SavePreferredTryoutArgs
) => Promise<
  FunctionReturnType<
    typeof api.learningPreferences.mutations.setPreferredTryoutCountry
  >
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
  return Effect.tryPromise({
    try: () =>
      setPreferredTryout({
        locale,
        preferredTryoutCountryKey: countryKey,
      }),
    catch: (cause) => new TryoutPreferenceSaveError({ cause }),
  }).pipe(
    Effect.catchAll((error) =>
      reportClientException(error, { countryKey, source }).pipe(
        Effect.zipRight(
          Effect.sync(() => {
            toast.error(errorMessage, { position: "bottom-center" });
          })
        )
      )
    )
  );
}
