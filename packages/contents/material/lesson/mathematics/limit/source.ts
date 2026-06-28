import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsLimitMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/limit",
  domain: "mathematics",
  key: "lesson.mathematics.limit",
  kind: "lesson",
  slug: "limit",
  routeSlugs: { en: "limit", id: "limit" },
  translations: {
    en: {
      description: "Use limits to read change in real situations.",
      title: "Limits",
    },
    id: {
      description: "Gunakan limit untuk membaca perubahan nyata.",
      title: "Limit",
    },
  },
  sections: [
    {
      slug: "application-of-limit-function",
      routeSlugs: {
        en: "application-of-limit-function",
        id: "aplikasi-limit-fungsi",
      },
      translations: {
        en: {
          title: "Application of Limit Function",
        },
        id: {
          title: "Aplikasi Limit Fungsi",
        },
      },
    },
    {
      slug: "concept-of-limit-function",
      routeSlugs: {
        en: "concept-of-limit-function",
        id: "konsep-limit-fungsi",
      },
      translations: {
        en: {
          title: "Concept of Limit Function",
        },
        id: {
          title: "Konsep Limit Fungsi",
        },
      },
    },
    {
      slug: "limit-of-algebraic-function",
      routeSlugs: {
        en: "limit-of-algebraic-function",
        id: "limit-fungsi-aljabar",
      },
      translations: {
        en: {
          title: "Limit of Algebraic Function",
        },
        id: {
          title: "Limit Fungsi Aljabar",
        },
      },
    },
    {
      slug: "limit-of-trigonometric-function",
      routeSlugs: {
        en: "limit-of-trigonometric-function",
        id: "limit-fungsi-trigonometri",
      },
      translations: {
        en: {
          title: "Limit of Trigonometric Function",
        },
        id: {
          title: "Limit Fungsi Trigonometri",
        },
      },
    },
    {
      slug: "properties-of-limit-function",
      routeSlugs: {
        en: "properties-of-limit-function",
        id: "sifat-limit-fungsi",
      },
      translations: {
        en: {
          title: "Properties of Limit Function",
        },
        id: {
          title: "Sifat Limit Fungsi",
        },
      },
    },
  ],
});
