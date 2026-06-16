import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsExponentialLogarithmMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/exponential-logarithm",
    domain: "mathematics",
    key: "lesson.mathematics.exponential-logarithm",
    kind: "lesson",
    slug: "exponential-logarithm",
    translations: {
      en: {
        description:
          "Exponent notation connects repeated multiplication to patterns such as paper folding, viral spread, and zero, negative, or fractional powers.",
        title: "Exponents and Logarithms",
      },
      id: {
        description:
          "Eksponen menghubungkan perkalian berulang dengan pola lipatan kertas, penyebaran virus, serta pangkat nol, negatif, dan pecahan.",
        title: "Eksponen dan Logaritma",
      },
    },
    sections: [
      {
        slug: "basic-concept",
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
