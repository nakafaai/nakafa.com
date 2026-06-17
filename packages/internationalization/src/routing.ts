import { defaultLocale, locales } from "@repo/utilities/locales";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales,
  defaultLocale,
  pathnames: {
    "/assessments/[assessment]/[[...path]]": {
      en: "/exams/[assessment]/[[...path]]",
      id: "/ujian/[assessment]/[[...path]]",
    },
    "/curricula/[curriculum]/[[...path]]": {
      en: "/curriculum/[curriculum]/[[...path]]",
      id: "/kurikulum/[curriculum]/[[...path]]",
    },
    "/materials/[subject]/[topic]/[[...lesson]]": {
      en: "/subjects/[subject]/[topic]/[[...lesson]]",
      id: "/materi/[subject]/[topic]/[[...lesson]]",
    },
    "/practice/[assessment]/[domain]/[[...path]]": {
      en: "/practice/[assessment]/[domain]/[[...path]]",
      id: "/latihan/[assessment]/[domain]/[[...path]]",
    },
  },
});
