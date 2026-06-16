import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsPolynomialMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/polynomial",
  domain: "mathematics",
  key: "lesson.mathematics.polynomial",
  kind: "lesson",
  slug: "polynomial",
  translations: {
    en: {
      description:
        "Learn polynomial addition and subtraction with worked examples. Understand like terms, horizontal and vertical methods, plus graphical visualization.",
      title: "Polynomial",
    },
    id: {
      description:
        "Pelajari penjumlahan dan pengurangan polinomial dengan contoh bertahap. Pahami suku sejenis, metode horizontal dan vertikal, serta visualisasi grafik.",
      title: "Polinomial",
    },
  },
  sections: [
    {
      slug: "addition-subtraction-polynomial",
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
