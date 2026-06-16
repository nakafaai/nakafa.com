import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsLimitMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/limit",
  domain: "mathematics",
  key: "lesson.mathematics.limit",
  kind: "lesson",
  slug: "limit",
  translations: {
    en: {
      description:
        "Apply limits to real-world scenarios: disease spread analysis, vaccination strategies, economic models, and marginal cost calculations with examples.",
      title: "Limits",
    },
    id: {
      description:
        "Terapkan limit pada skenario dunia nyata: analisis penyebaran penyakit, strategi vaksinasi, model ekonomi, dan perhitungan biaya marginal dengan contoh.",
      title: "Limit",
    },
  },
  sections: [
    {
      slug: "application-of-limit-function",
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
