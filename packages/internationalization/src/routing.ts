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
