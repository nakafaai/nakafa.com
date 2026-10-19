import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

/** The locales the public product serves, owned by the Aksara contract. */
export const LocaleSchema = ActiveAppLocaleCodeSchema;

export type Locale = typeof LocaleSchema.Type;

/** The public locales in contract order. */
export const LOCALES = ACTIVE_APP_LOCALE_CODES;

/**
 * The locale of a URL that names none. It is also the `x-default` of every
 * alternate list, so the first contract locale is the one that answers.
 */
export const DEFAULT_LOCALE = ACTIVE_APP_LOCALE_CODES[0];

/**
 * The cookie that stores a visitor's locale choice. The product writes and
 * reads this name only, so a cookie from an older product is never read.
 */
export const LOCALE_COOKIE = "NAKAFA_LOCALE";

/** The attributes of the locale cookie: every path reads it, and same-site navigations send it. */
export const LOCALE_COOKIE_ATTRIBUTES = { path: "/", sameSite: "lax" } as const;

/** Decodes an unknown value into a public locale, or none. */
export const decodeLocale = Schema.decodeUnknownOption(LocaleSchema);
