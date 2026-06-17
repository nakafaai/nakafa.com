import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsFunctionCompositionInverseFunctionMaterial =
  defineLessonMaterial({
    assetRoot:
      "material/lesson/mathematics/function-composition-inverse-function",
    domain: "mathematics",
    key: "lesson.mathematics.function-composition-inverse-function",
    kind: "lesson",
    slug: "function-composition-inverse-function",
    routeSlugs: {
      en: "function-composition-inverse-function",
      id: "fungsi-komposisi-dan-fungsi-invers",
    },
    translations: {
      en: {
        description: "Operate on functions while tracking shared domains.",
        title: "Function Composition and Inverse Function",
      },
      id: {
        description: "Operasikan fungsi sambil menjaga domain bersama.",
        title: "Fungsi Komposisi dan Fungsi Invers",
      },
    },
    sections: [
      {
        slug: "addition-subtraction-function",
        routeSlugs: {
          en: "addition-subtraction-function",
          id: "penjumlahan-dan-pengurangan-fungsi",
        },
        translations: {
          en: {
            title: "Addition and Subtraction of Functions",
          },
          id: {
            title: "Penjumlahan dan Pengurangan Fungsi",
          },
        },
      },
      {
        slug: "domain-codomain-range",
        routeSlugs: {
          en: "domain-codomain-range",
          id: "domain-kodomain-dan-range",
        },
        translations: {
          en: {
            title: "Domain, Codomain, and Range",
          },
          id: {
            title: "Domain, Kodomain, dan Range",
          },
        },
      },
      {
        slug: "function-and-non-function",
        routeSlugs: {
          en: "function-and-non-function",
          id: "fungsi-dan-bukan-fungsi",
        },
        translations: {
          en: {
            title: "Function and Non-Function",
          },
          id: {
            title: "Fungsi dan Bukan Fungsi",
          },
        },
      },
      {
        slug: "function-composition",
        routeSlugs: { en: "function-composition", id: "komposisi-fungsi" },
        translations: {
          en: {
            title: "Function Composition",
          },
          id: {
            title: "Komposisi Fungsi",
          },
        },
      },
      {
        slug: "function-concept",
        routeSlugs: { en: "function-concept", id: "konsep-fungsi" },
        translations: {
          en: {
            title: "Function Concept",
          },
          id: {
            title: "Konsep Fungsi",
          },
        },
      },
      {
        slug: "injective-surjective-bijective-function",
        routeSlugs: {
          en: "injective-surjective-bijective-function",
          id: "fungsi-injektif-surjektif-dan-bijektif",
        },
        translations: {
          en: {
            title: "Injective, Surjective, and Bijective Functions",
          },
          id: {
            title: "Fungsi Injektif, Surjektif, dan Bijektif",
          },
        },
      },
      {
        slug: "inverse-function",
        routeSlugs: { en: "inverse-function", id: "fungsi-invers" },
        translations: {
          en: {
            title: "Inverse Function",
          },
          id: {
            title: "Fungsi Invers",
          },
        },
      },
      {
        slug: "multiplication-division-function",
        routeSlugs: {
          en: "multiplication-division-function",
          id: "perkalian-dan-pembagian-fungsi",
        },
        translations: {
          en: {
            title: "Multiplication and Division of Functions",
          },
          id: {
            title: "Perkalian dan Pembagian Fungsi",
          },
        },
      },
      {
        slug: "properties-of-function-composition",
        routeSlugs: {
          en: "properties-of-function-composition",
          id: "sifat-komposisi-fungsi",
        },
        translations: {
          en: {
            title: "Properties of Function Composition",
          },
          id: {
            title: "Sifat Komposisi Fungsi",
          },
        },
      },
      {
        slug: "properties-of-inverse-function",
        routeSlugs: {
          en: "properties-of-inverse-function",
          id: "sifat-fungsi-invers",
        },
        translations: {
          en: {
            title: "Properties of Inverse Function",
          },
          id: {
            title: "Sifat Fungsi Invers",
          },
        },
      },
    ],
  });
