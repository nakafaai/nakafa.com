"use client";

import { readCookie } from "@repo/internationalization/src/cookie";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_ATTRIBUTES,
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { Effect, Option, Schema } from "effect";
import { saveSchoolLanguage } from "@/components/tenant/language";
import { reportClientException } from "@/lib/analytics/client";

/** The save of the language did not finish. `reason` keeps the rejection that the network or the server raised. */
export class LanguageSaveFailed extends Schema.TaggedError<LanguageSaveFailed>()(
  "LanguageSaveFailed",
  { reason: Schema.Unknown }
) {}

/** How long the language cookie lasts in the browser, which matches the server's one year. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * How a language change ends. `saved` keeps the language it showed at once. `rolledBack` returns
 * the page to the language it had, because the save failed, and the viewer is told.
 */
const SchoolLanguageOutcome = Schema.Literals(["saved", "rolledBack"]);

/** The way a language change ended. */
type SchoolLanguageOutcome = typeof SchoolLanguageOutcome.Type;

/**
 * The language cookie of this browser, or none when the browser holds none. The server reads the
 * same cookie on the next request, so writing it shows the new language before the save answers.
 */
function readLanguageCookie(): Option.Option<string> {
  return readCookie(new Headers({ cookie: document.cookie }), LOCALE_COOKIE);
}

/** The cookie line of the language with its attributes, which the server's own write also sets. */
function languageCookieLine(value: string, maxAge: number) {
  return `${LOCALE_COOKIE}=${value}; Max-Age=${maxAge}; Path=${LOCALE_COOKIE_ATTRIBUTES.path}; SameSite=${LOCALE_COOKIE_ATTRIBUTES.sameSite}`;
}

/** Writes the language cookie of this browser for the chosen language. */
function writeLanguageCookie(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in some supported browsers, and the server reads this cookie line.
  document.cookie = languageCookieLine(locale, LOCALE_COOKIE_MAX_AGE);
}

/** Puts back the language cookie that a failed save replaced, or removes the cookie when there was none. */
function restoreLanguageCookie(previous: Option.Option<string>) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in some supported browsers, and the server reads this cookie line.
  document.cookie = Option.match(previous, {
    onNone: () => languageCookieLine("", 0),
    onSome: (locale) => languageCookieLine(locale, LOCALE_COOKIE_MAX_AGE),
  });
}

/**
 * Changes the language of the school at once, then saves it. The language cookie takes the new
 * value and `refresh` renders the current route in it, so the page changes before the server
 * answers. A save that fails puts the old cookie back, renders the route in the old language again,
 * and reports the failure. The page keeps its place either way.
 */
export const changeSchoolLanguage = Effect.fn("tenant.language.change")(
  function* (value: string, refresh: () => void) {
    const locale = yield* Schema.decodeUnknownEffect(LocaleSchema)(value).pipe(
      Effect.mapError((reason) => new LanguageSaveFailed({ reason }))
    );
    const previous = yield* Effect.sync(() => {
      const before = readLanguageCookie();
      writeLanguageCookie(locale);
      refresh();
      return before;
    });
    return yield* Effect.tryPromise({
      catch: (reason) => new LanguageSaveFailed({ reason }),
      try: () => saveSchoolLanguage({ data: locale }),
    }).pipe(
      Effect.as<SchoolLanguageOutcome>("saved"),
      Effect.catch(({ reason }) =>
        Effect.sync(() => {
          restoreLanguageCookie(previous);
          refresh();
        }).pipe(
          Effect.andThen(
            reportClientException(reason, { source: "school-language" })
          ),
          Effect.as<SchoolLanguageOutcome>("rolledBack")
        )
      )
    );
  }
);
