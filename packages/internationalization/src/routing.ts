import { defaultLocale, locales } from "@repo/utilities/locales";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Page metadata and sitemap build source-identity alternates for projected content routes.
  alternateLinks: false,
  locales,
  defaultLocale,
  pathnames: {
    "/curricula": {
      en: "/curriculum",
      id: "/kurikulum",
    },
    "/curricula/[curriculum]/[[...path]]": {
      en: "/curriculum/[curriculum]/[[...path]]",
      id: "/kurikulum/[curriculum]/[[...path]]",
    },
    "/materials/[subject]/[topic]/[[...lesson]]": {
      en: "/subjects/[subject]/[topic]/[[...lesson]]",
      id: "/materi/[subject]/[topic]/[[...lesson]]",
    },
    "/practice/[assessment]": {
      en: "/practice/[assessment]",
      id: "/latihan/[assessment]",
    },
    "/practice/[assessment]/[domain]/[[...path]]": {
      en: "/practice/[assessment]/[domain]/[[...path]]",
      id: "/latihan/[assessment]/[domain]/[[...path]]",
    },
  },
});
