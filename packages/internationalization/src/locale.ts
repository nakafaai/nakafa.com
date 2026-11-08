import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

/** The locales the public product serves, owned by the Aksara contract. */
export const LocaleSchema = ActiveAppLocaleCodeSchema;

export type Locale = typeof LocaleSchema.Type;

/** The public locales in contract order. */
export const LOCALES = ACTIVE_APP_LOCALE_CODES;

/**
 * The canonical locale: the `x-default` of every alternate list, and the one
 * locale of the feeds and catalogs that name a single locale, so the first
 * contract locale is the one that answers. A visitor is never sent here for
 * want of a language; that is `VISITOR_LOCALE`.
 */
export const DEFAULT_LOCALE = ACTIVE_APP_LOCALE_CODES[0];

/**
 * The locale a visitor reads in when neither their language cookie nor their
 * browser's languages name a Nakafa locale: Indonesian, the language of most of
 * Nakafa's learners (owner, 8 Nov 2026). The root and every address that names
 * no locale move there.
 */
export const VISITOR_LOCALE = INDONESIAN_APP_LOCALE_CODE;

/**
 * The cookie that stores a visitor's locale choice. The product writes and
 * reads this name only, so a cookie from an older product is never read.
 */
export const LOCALE_COOKIE = "NAKAFA_LOCALE";

/** The attributes of the locale cookie: every path reads it, and same-site navigations send it. */
export const LOCALE_COOKIE_ATTRIBUTES = { path: "/", sameSite: "lax" } as const;

/** Decodes an unknown value into a public locale, or none. */
export const decodeLocale = Schema.decodeUnknownOption(LocaleSchema);

/**
 * The time zone that each locale formats dates and times in. Server and client
 * render one clock, and use-intl logs ENVIRONMENT_FALLBACK for a date without one.
 */
const LOCALE_TIME_ZONES = {
  de: "Europe/Berlin",
  en: "Asia/Jakarta",
  id: "Asia/Jakarta",
} as const satisfies Record<Locale, string>;

/** The time zone that dates of one locale are formatted in. */
export function localeTimeZone(locale: Locale) {
  return LOCALE_TIME_ZONES[locale];
}
