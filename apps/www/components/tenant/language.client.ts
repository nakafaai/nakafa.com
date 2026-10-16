"use client";

import { Effect, Schema } from "effect";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { saveSchoolLanguage } from "@/components/tenant/language";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The save of the language did not finish. `reason` keeps the rejection that
 * Next.js or the network raised, because the unrecognized-action check reads it.
 */
class LanguageSaveFailed extends Schema.TaggedError<LanguageSaveFailed>()(
  "LanguageSaveFailed",
  { reason: Schema.Unknown }
) {}

/**
 * Saves the language that the account menu chose, then reloads, so the proxy
 * renders the page again in it. A tab that still runs the build from before a
 * deployment holds action IDs that the server no longer knows. Next.js reports
 * that as an unrecognized action, and a reload loads the current build, so that
 * case reloads without a report. Any other failure is reported, and the reload
 * still runs, because a refresh is the recovery that Next.js asks an app to
 * offer.
 */
export const changeSchoolLanguage = Effect.fn("tenant.language.change")(
  function* (locale: string) {
    yield* Effect.tryPromise({
      catch: (reason) => new LanguageSaveFailed({ reason }),
      try: () => saveSchoolLanguage(locale),
    }).pipe(
      Effect.catch(({ reason }) =>
        unstable_isUnrecognizedActionError(reason)
          ? Effect.void
          : reportClientException(reason, { source: "school-language" })
      )
    );
    yield* Effect.sync(() => window.location.reload());
  }
);
