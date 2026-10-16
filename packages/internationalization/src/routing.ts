import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
  APP_LOCALE_CODES,
} from "@nakafa/aksara-contracts/locale";
import { defineRouting } from "next-intl/routing";

const defaultLocale = ACTIVE_APP_LOCALE_CODES[0];

const pathnames = {
  "/curricula": {
    de: "/lehrplaene",
    en: "/curriculum",
    id: "/kurikulum",
  },
  "/curricula/[curriculum]/[[...path]]": {
    de: "/lehrplaene/[curriculum]/[[...path]]",
    en: "/curriculum/[curriculum]/[[...path]]",
    id: "/kurikulum/[curriculum]/[[...path]]",
  },
  "/materials/[subject]/[topic]/[[...lesson]]": {
    de: "/faecher/[subject]/[topic]/[[...lesson]]",
    en: "/subjects/[subject]/[topic]/[[...lesson]]",
    id: "/materi/[subject]/[topic]/[[...lesson]]",
  },
} as const;

export const routing = defineRouting({
  // Page metadata and sitemap build source-identity alternates for projected content routes.
  alternateLinks: false,
  locales: ACTIVE_APP_LOCALE_CODES,
  defaultLocale,
  pathnames,
});

/** Application locale currently exposed through public product routes. */
export type PublicAppLocale = ActiveAppLocaleCode;

/** Full contract locale routing used only by authenticated local previews. */
export const previewRouting = defineRouting({
  alternateLinks: false,
  locales: APP_LOCALE_CODES,
  defaultLocale,
  pathnames,
});

/**
 * The language cookie of a school host. next-intl reads it under this name, and
 * the account menu writes it with the same name, path and SameSite, so both
 * read one value. `defineRouting` returns its input unchanged, so the routing
 * object carries the cookie itself rather than a default filled in later.
 */
export const schoolLocaleCookie = {
  name: "NEXT_LOCALE",
  path: "/",
  sameSite: "lax",
} satisfies NonNullable<Parameters<typeof defineRouting>[0]["localeCookie"]>;

/**
 * Locale routing for school hosts, whose addresses carry no locale. next-intl
 * reads the `NEXT_LOCALE` cookie, then `Accept-Language`, then the default
 * locale, and rewrites the request to `/[locale]/...` without a redirect.
 */
export const schoolRouting = defineRouting({
  alternateLinks: false,
  defaultLocale,
  locales: ACTIVE_APP_LOCALE_CODES,
  localeCookie: schoolLocaleCookie,
  localePrefix: "never",
});
