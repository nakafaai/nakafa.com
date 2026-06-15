import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectMiddleSchool7MathematicsIntegersTopic =
  defineSubjectMaterialTopic({
    slug: "integers",
    translations: {
      en: {
        description:
          "Read positive and negative numbers, factors, GCD, and LCM for everyday calculations.",
        title: "Integers",
      },
      id: {
        description:
          "Membaca bilangan positif, negatif, faktor, FPB, dan KPK untuk perhitungan sehari-hari.",
        title: "Bilangan Bulat",
      },
    },
    sections: [
      {
        slug: "what-is-integer",
        translations: {
          en: {
            title: "What are Integers?",
          },
          id: {
            title: "Apa itu Bilangan Bulat?",
          },
        },
      },
      {
        slug: "comparing-integers",
        translations: {
          en: {
            title: "Comparing Integers",
          },
          id: {
            title: "Membandingkan Bilangan Bulat",
          },
        },
      },
      {
        slug: "addition-subtraction",
        translations: {
          en: {
            title: "Integer Addition and Subtraction",
          },
          id: {
            title: "Operasi Penjumlahan dan Pengurangan Bilangan Bulat",
          },
        },
      },
      {
        slug: "multiplication-division",
        translations: {
          en: {
            title: "Integer Multiplication and Division",
          },
          id: {
            title: "Operasi Perkalian dan Pembagian Bilangan Bulat",
          },
        },
      },
      {
        slug: "positive-negative-factors",
        translations: {
          en: {
            title: "Positive and Negative Factors",
          },
          id: {
            title: "Faktor Bilangan Bulat Positif dan Negatif",
          },
        },
      },
      {
        slug: "greatest-common-divisor",
        translations: {
          en: {
            title: "Greatest Common Divisor",
          },
          id: {
            title: "Faktor Persekutuan terbesar",
          },
        },
      },
      {
        slug: "least-common-multiple",
        translations: {
          en: {
            title: "Least Common Multiple",
          },
          id: {
            title: "Kelipatan Persekutuan terkecil",
          },
        },
      },
    ],
  });
