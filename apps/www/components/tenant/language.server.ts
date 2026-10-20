import "@tanstack/react-start/server-only";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_ATTRIBUTES,
  type Locale,
} from "@repo/internationalization/src/locale";
import { setCookie } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { serverHandler } from "@/lib/server/fn";

/** How long the language cookie lasts, in seconds: one year. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Writes the language that a school host renders. The request reads the cookie
 * before it renders a page, so the next page comes back in that language. A
 * cookie can only be written on the server, which is the framework boundary.
 */
const rememberSchoolLanguage = Effect.fn("tenant.language.remember")(function* (
  locale: Locale
) {
  yield* Effect.sync(() => {
    setCookie(LOCALE_COOKIE, locale, {
      ...LOCALE_COOKIE_ATTRIBUTES,
      maxAge: LOCALE_COOKIE_MAX_AGE,
    });
  });
});

/** The handler of the language server function, which the tests call directly. */
export const saveSchoolLanguageHandler = serverHandler(rememberSchoolLanguage);
