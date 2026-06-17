import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsFunctionModelingMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/function-modeling",
  domain: "mathematics",
  key: "lesson.mathematics.function-modeling",
  kind: "lesson",
  slug: "function-modeling",
  routeSlugs: { en: "function-modeling", id: "fungsi-dan-pemodelannya" },
  translations: {
    en: {
      description:
        "Learn absolute value functions with interactive graphs, transformations, and worked solutions. Learn properties, equations, and real applications.",
      title: "Functions and Their Modeling",
    },
    id: {
      description:
        "Pelajari fungsi nilai mutlak dengan grafik interaktif, transformasi, dan solusi bertahap. Pahami sifat, persamaan, dan aplikasi nyata.",
      title: "Fungsi dan Pemodelannya",
    },
  },
  sections: [
    {
      slug: "absolute-value-function",
      routeSlugs: { en: "absolute-value-function", id: "fungsi-nilai-mutlak" },
      translations: {
        en: {
          title: "Absolute Value Function",
        },
        id: {
          title: "Fungsi Nilai Mutlak",
        },
      },
    },
    {
      slug: "asymptote",
      routeSlugs: { en: "asymptote", id: "asimtot" },
      translations: {
        en: {
          title: "Asymptote",
        },
        id: {
          title: "Asimtot",
        },
      },
    },
    {
      slug: "exponential-function",
      routeSlugs: { en: "exponential-function", id: "fungsi-eksponensial" },
      translations: {
        en: {
          title: "Exponential Function",
        },
        id: {
          title: "Fungsi Eksponensial",
        },
      },
    },
    {
      slug: "logarithmic-function-concept",
      routeSlugs: {
        en: "logarithmic-function-concept",
        id: "konsep-fungsi-logaritma",
      },
      translations: {
        en: {
          title: "Logarithmic Function Concept",
        },
        id: {
          title: "Konsep Fungsi Logaritma",
        },
      },
    },
    {
      slug: "logarithmic-function-graph",
      routeSlugs: {
        en: "logarithmic-function-graph",
        id: "grafik-fungsi-logaritma",
      },
      translations: {
        en: {
          title: "Logarithmic Function Graph",
        },
        id: {
          title: "Grafik Fungsi Logaritma",
        },
      },
    },
    {
      slug: "logarithmic-function-identity",
      routeSlugs: {
        en: "logarithmic-function-identity",
        id: "identitas-fungsi-logaritma",
      },
      translations: {
        en: {
          title: "Logarithmic Function Identity",
        },
        id: {
          title: "Identitas Fungsi Logaritma",
        },
      },
    },
    {
      slug: "piecewise-function-modeling",
      routeSlugs: {
        en: "piecewise-function-modeling",
        id: "pemodelan-fungsi-piecewise",
      },
      translations: {
        en: {
          title: "Piecewise Function Modeling",
        },
        id: {
          title: "Pemodelan Fungsi Piecewise",
        },
      },
    },
    {
      slug: "rational-function",
      routeSlugs: { en: "rational-function", id: "fungsi-rasional" },
      translations: {
        en: {
          title: "Rational Function",
        },
        id: {
          title: "Fungsi Rasional",
        },
      },
    },
    {
      slug: "square-root-function",
      routeSlugs: { en: "square-root-function", id: "fungsi-akar" },
      translations: {
        en: {
          title: "Square Root Function",
        },
        id: {
          title: "Fungsi Akar",
        },
      },
    },
    {
      slug: "step-function-modeling",
      routeSlugs: {
        en: "step-function-modeling",
        id: "pemodelan-fungsi-tangga",
      },
      translations: {
        en: {
          title: "Step Function Modeling",
        },
        id: {
          title: "Pemodelan Fungsi Tangga",
        },
      },
    },
    {
      slug: "trigonometric-function-arbitrary-angle",
      routeSlugs: {
        en: "trigonometric-function-arbitrary-angle",
        id: "fungsi-trigonometri-sebarang-sudut",
      },
      translations: {
        en: {
          title: "Trigonometric Function of Arbitrary Angle",
        },
        id: {
          title: "Fungsi Trigonometri Sebarang Sudut",
        },
      },
    },
    {
      slug: "trigonometric-function-graph",
      routeSlugs: {
        en: "trigonometric-function-graph",
        id: "grafik-fungsi-trigonometri",
      },
      translations: {
        en: {
          title: "Trigonometric Function Graph",
        },
        id: {
          title: "Grafik Fungsi Trigonometri",
        },
      },
    },
    {
      slug: "trigonometric-identity",
      routeSlugs: {
        en: "trigonometric-identity",
        id: "identitas-trigonometri",
      },
      translations: {
        en: {
          title: "Trigonometric Identity",
        },
        id: {
          title: "Identitas Trigonometri",
        },
      },
    },
  ],
});
