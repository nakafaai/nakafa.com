"use server";

import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { schoolLocaleCookie } from "@repo/internationalization/src/routing";
import { Effect, Schema } from "effect";
import { cookies } from "next/headers";

/** The languages a school host renders, which the language cookie may hold. */
const SchoolLocale = Schema.Literals(ACTIVE_APP_LOCALE_CODES);

/** How long the language cookie lasts, in seconds: one year. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Writes the language that a school host renders. The proxy reads the cookie
 * before it renders a page, so the next page comes back in that language. A
 * cookie can only be written here, on the server, which is the framework
 * boundary for it.
 */
const remember = Effect.fn("tenant.language.remember")(function* (
  value: unknown
) {
  const locale = yield* Schema.decodeUnknownEffect(SchoolLocale)(value);
  const store = yield* Effect.tryPromise(() => cookies());
  yield* Effect.sync(() => {
    store.set(schoolLocaleCookie.name, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: schoolLocaleCookie.path,
      sameSite: schoolLocaleCookie.sameSite,
    });
  });
});

/** Saves the language of a school host from the account menu. */
export async function saveSchoolLanguage(locale: unknown) {
  await Effect.runPromise(remember(locale));
}
