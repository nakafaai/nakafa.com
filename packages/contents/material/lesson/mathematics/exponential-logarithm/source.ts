import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsExponentialLogarithmMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/exponential-logarithm",
    domain: "mathematics",
    key: "lesson.mathematics.exponential-logarithm",
    kind: "lesson",
    slug: "exponential-logarithm",
    routeSlugs: { en: "exponential-logarithm", id: "eksponen-dan-logaritma" },
    translations: {
      en: {
        description: "Connect repeated multiplication to exponent patterns.",
        title: "Exponents and Logarithms",
      },
      id: {
        description: "Hubungkan perkalian berulang dengan pola eksponen.",
        title: "Eksponen dan Logaritma",
      },
    },
    sections: [
      {
        slug: "basic-concept",
        routeSlugs: { en: "basic-concept", id: "konsep-eksponen" },
        translations: {
          en: {
            title: "Exponent Concepts",
          },
          id: {
            title: "Konsep Eksponen",
          },
        },
      },
      {
        slug: "exponential-decay",
        routeSlugs: { en: "exponential-decay", id: "peluruhan-eksponen" },
        translations: {
          en: {
            title: "Exponential Decay",
          },
          id: {
            title: "Peluruhan Eksponen",
          },
        },
      },
      {
        slug: "exponential-growth",
        routeSlugs: { en: "exponential-growth", id: "pertumbuhan-eksponen" },
        translations: {
          en: {
            title: "Exponential Growth",
          },
          id: {
            title: "Pertumbuhan Eksponen",
          },
        },
      },
      {
        slug: "function-definition",
        routeSlugs: { en: "function-definition", id: "definisi-fungsi" },
        translations: {
          en: {
            title: "Function Definition",
          },
          id: {
            title: "Definisi Fungsi",
          },
        },
      },
      {
        slug: "function-exploration",
        routeSlugs: { en: "function-exploration", id: "eksplorasi-fungsi" },
        translations: {
          en: {
            title: "Function Exploration",
          },
          id: {
            title: "Eksplorasi Fungsi",
          },
        },
      },
      {
        slug: "logarithm-definition",
        routeSlugs: { en: "logarithm-definition", id: "definisi-logaritma" },
        translations: {
          en: {
            title: "Logarithm Definition",
          },
          id: {
            title: "Definisi Logaritma",
          },
        },
      },
      {
        slug: "logarithm-properties",
        routeSlugs: { en: "logarithm-properties", id: "sifat-logaritma" },
        translations: {
          en: {
            title: "Logarithm Properties",
          },
          id: {
            title: "Sifat Logaritma",
          },
        },
      },
      {
        slug: "proof-properties",
        routeSlugs: { en: "proof-properties", id: "pembuktian-sifat" },
        translations: {
          en: {
            title: "Property Proofs",
          },
          id: {
            title: "Pembuktian Sifat",
          },
        },
      },
      {
        slug: "properties",
        routeSlugs: { en: "properties", id: "sifat-eksponen" },
        translations: {
          en: {
            title: "Exponent Properties",
          },
          id: {
            title: "Sifat Eksponen",
          },
        },
      },
      {
        slug: "radical-form",
        routeSlugs: { en: "radical-form", id: "bentuk-akar" },
        translations: {
          en: {
            title: "Radical Form",
          },
          id: {
            title: "Bentuk Akar",
          },
        },
      },
      {
        slug: "rationalizing-radicals",
        routeSlugs: { en: "rationalizing-radicals", id: "merasionalkan-akar" },
        translations: {
          en: {
            title: "Rationalizing Radicals",
          },
          id: {
            title: "Merasionalkan Akar",
          },
        },
      },
    ],
  });
