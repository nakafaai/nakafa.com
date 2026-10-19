"use client";

import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Effect, Schema } from "effect";
import { saveSchoolLanguage } from "@/components/tenant/language";
import { reportClientException } from "@/lib/analytics/client";

/** The save of the language did not finish. `reason` keeps the rejection that the network or the server raised. */
export class LanguageSaveFailed extends Schema.TaggedError<LanguageSaveFailed>()(
  "LanguageSaveFailed",
  { reason: Schema.Unknown }
) {}

/**
 * How the page shows the saved language. `refresh` renders the current route
 * again in place, so the document, its scroll position and its state stay.
 * `failed` leaves the page in its language, because nothing was saved.
 */
const SchoolLanguageRender = Schema.Literals(["refresh", "failed"]);

/** The way the page shows the saved language. */
type SchoolLanguageRender = typeof SchoolLanguageRender.Type;

/**
 * Saves the language that the account menu chose, then says how to show it. A
 * saved language refreshes the current route in place. A failed save is
 * reported and answers `failed`, so the menu can tell the viewer and offer to
 * try again.
 */
export const changeSchoolLanguage = Effect.fn("tenant.language.change")(
  function* (value: string) {
    const locale = yield* Schema.decodeUnknownEffect(LocaleSchema)(value).pipe(
      Effect.mapError((reason) => new LanguageSaveFailed({ reason }))
    );
    return yield* Effect.tryPromise({
      catch: (reason) => new LanguageSaveFailed({ reason }),
      try: () => saveSchoolLanguage({ data: locale }),
    }).pipe(
      Effect.as<SchoolLanguageRender>("refresh"),
      Effect.catch(({ reason }) =>
        reportClientException(reason, { source: "school-language" }).pipe(
          Effect.as<SchoolLanguageRender>("failed")
        )
      )
    );
  }
);
