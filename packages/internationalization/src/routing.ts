import { materialSegments } from "@repo/internationalization/src/segments";
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
    "/materials/chemistry/[topic]/[[...lesson]]": {
      en: `/${materialSegments.en.namespace}/${materialSegments.en.chemistry}/[topic]/[[...lesson]]`,
      id: `/${materialSegments.id.namespace}/${materialSegments.id.chemistry}/[topic]/[[...lesson]]`,
    },
    "/materials/mathematics/[topic]/[[...lesson]]": {
      en: `/${materialSegments.en.namespace}/${materialSegments.en.mathematics}/[topic]/[[...lesson]]`,
      id: `/${materialSegments.id.namespace}/${materialSegments.id.mathematics}/[topic]/[[...lesson]]`,
    },
    "/materials/[subject]/[topic]/[[...lesson]]": {
      en: `/${materialSegments.en.namespace}/[subject]/[topic]/[[...lesson]]`,
      id: `/${materialSegments.id.namespace}/[subject]/[topic]/[[...lesson]]`,
    },
  },
});
