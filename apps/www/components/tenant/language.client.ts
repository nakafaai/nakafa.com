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
 * How the page shows the saved language. `refresh` renders the current route
 * again in place, so the document, its scroll position and its state stay.
 * `reload` loads the document again.
 */
const SchoolLanguageRender = Schema.Literals(["refresh", "reload"]);

/** The way the page shows the saved language. */
type SchoolLanguageRender = typeof SchoolLanguageRender.Type;

/**
 * Saves the language that the account menu chose, then says how to show it. A
 * tab that still runs the build from before a deployment holds action IDs that
 * the server no longer knows. Next.js reports that as an unrecognized action,
 * and only a reload loads the current build, so that case answers `reload`
 * without a report. Every other save answers `refresh`: the proxy renders the
 * page again in the new language. A failed save is reported and still answers
 * `refresh`, because a refresh is the recovery that Next.js asks an app to offer.
 */
export const changeSchoolLanguage = Effect.fn("tenant.language.change")(
  function* (locale: string) {
    return yield* Effect.tryPromise({
      catch: (reason) => new LanguageSaveFailed({ reason }),
      try: () => saveSchoolLanguage(locale),
    }).pipe(
      Effect.as<SchoolLanguageRender>("refresh"),
      Effect.catch(({ reason }) =>
        unstable_isUnrecognizedActionError(reason)
          ? Effect.succeed<SchoolLanguageRender>("reload")
          : reportClientException(reason, { source: "school-language" }).pipe(
              Effect.as<SchoolLanguageRender>("refresh")
            )
      )
    );
  }
);
