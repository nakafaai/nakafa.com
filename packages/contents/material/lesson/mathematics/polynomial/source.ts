import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsPolynomialMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/polynomial",
  domain: "mathematics",
  key: "lesson.mathematics.polynomial",
  kind: "lesson",
  slug: "polynomial",
  routeSlugs: { en: "polynomial", id: "polinomial" },
  translations: {
    en: {
      description: "Combine like terms with polynomial operations.",
      title: "Polynomial",
    },
    id: {
      description: "Gabungkan suku sejenis dalam operasi polinomial.",
      title: "Polinomial",
    },
  },
  sections: [
    {
      slug: "addition-subtraction-polynomial",
      routeSlugs: {
        en: "addition-subtraction-polynomial",
        id: "penjumlahan-dan-pengurangan-polinomial",
      },
      translations: {
        en: {
          title: "Addition and Subtraction of Polynomials",
        },
        id: {
          title: "Penjumlahan dan Pengurangan Polinomial",
        },
      },
    },
    {
      slug: "division-polynomial",
      routeSlugs: { en: "division-polynomial", id: "pembagian-polinomial" },
      translations: {
        en: {
          title: "Division of Polynomials",
        },
        id: {
          title: "Pembagian Polinomial",
        },
      },
    },
    {
      slug: "factor-theorem",
      routeSlugs: { en: "factor-theorem", id: "teorema-faktor" },
      translations: {
        en: {
          title: "Factor Theorem",
        },
        id: {
          title: "Teorema Faktor",
        },
      },
    },
    {
      slug: "horner-method",
      routeSlugs: { en: "horner-method", id: "metode-horner" },
      translations: {
        en: {
          title: "Horner's Method",
        },
        id: {
          title: "Metode Horner",
        },
      },
    },
    {
      slug: "multiplication-polynomial",
      routeSlugs: {
        en: "multiplication-polynomial",
        id: "perkalian-polinomial",
      },
      translations: {
        en: {
          title: "Multiplication of Polynomials",
        },
        id: {
          title: "Perkalian Polinomial",
        },
      },
    },
    {
      slug: "polynomial-concept",
      routeSlugs: { en: "polynomial-concept", id: "konsep-polinomial" },
      translations: {
        en: {
          title: "Polynomial Concept",
        },
        id: {
          title: "Konsep Polinomial",
        },
      },
    },
    {
      slug: "polynomial-degree",
      routeSlugs: { en: "polynomial-degree", id: "derajat-polinomial" },
      translations: {
        en: {
          title: "Polynomial Degree",
        },
        id: {
          title: "Derajat Polinomial",
        },
      },
    },
    {
      slug: "polynomial-factorization",
      routeSlugs: {
        en: "polynomial-factorization",
        id: "faktorisasi-penuh-polinomial",
      },
      translations: {
        en: {
          title: "Complete Polynomial Factorization",
        },
        id: {
          title: "Faktorisasi Penuh Polinomial",
        },
      },
    },
    {
      slug: "polynomial-function",
      routeSlugs: { en: "polynomial-function", id: "fungsi-polinomial" },
      translations: {
        en: {
          title: "Polynomial Function",
        },
        id: {
          title: "Fungsi Polinomial",
        },
      },
    },
    {
      slug: "polynomial-graph",
      routeSlugs: { en: "polynomial-graph", id: "grafik-fungsi-polinomial" },
      translations: {
        en: {
          title: "Polynomial Graph",
        },
        id: {
          title: "Grafik Fungsi Polinomial",
        },
      },
    },
    {
      slug: "polynomial-identity",
      routeSlugs: { en: "polynomial-identity", id: "identitas-polinomial" },
      translations: {
        en: {
          title: "Polynomial Identity",
        },
        id: {
          title: "Identitas Polinomial",
        },
      },
    },
    {
      slug: "rational-zero",
      routeSlugs: { en: "rational-zero", id: "pembuat-nol-rasional" },
      translations: {
        en: {
          title: "Rational Zero Theorem",
        },
        id: {
          title: "Pembuat Nol Rasional",
        },
      },
    },
    {
      slug: "remainder-theorem",
      routeSlugs: { en: "remainder-theorem", id: "teorema-sisa" },
      translations: {
        en: {
          title: "Remainder Theorem",
        },
        id: {
          title: "Teorema Sisa",
        },
      },
    },
    {
      slug: "synthetic-division",
      routeSlugs: { en: "synthetic-division", id: "pembagian-bersusun" },
      translations: {
        en: {
          title: "Polynomial Long Division",
        },
        id: {
          title: "Pembagian Bersusun",
        },
      },
    },
  ],
});
