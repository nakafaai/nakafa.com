import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_ATTRIBUTES,
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { Effect, Schema } from "effect";

/** The language that the account menu passed is not a language of Nakafa. */
export class SchoolLanguageUnknown extends Schema.TaggedError<SchoolLanguageUnknown>()(
  "SchoolLanguageUnknown",
  { reason: Schema.Unknown }
) {}

/** How long the language cookie lasts in the browser: one year. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Writes the language cookie of this browser for the chosen language. */
function writeLanguageCookie(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in some supported browsers.
  document.cookie = `${LOCALE_COOKIE}=${locale}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=${LOCALE_COOKIE_ATTRIBUTES.path}; SameSite=${LOCALE_COOKIE_ATTRIBUTES.sameSite}`;
}

/**
 * Changes the language of the school at once. A school renders only in the
 * browser, which negotiates every page's language from this cookie, so writing it
 * and rendering the current route again shows the new language, and every later
 * page of the school keeps it.
 */
export const changeSchoolLanguage = Effect.fn("tenant.language.change")(
  function* (value: string, refresh: () => void) {
    const locale = yield* Schema.decodeUnknownEffect(LocaleSchema)(value).pipe(
      Effect.mapError((reason) => new SchoolLanguageUnknown({ reason }))
    );
    yield* Effect.sync(() => {
      writeLanguageCookie(locale);
      refresh();
    });
  }
);
