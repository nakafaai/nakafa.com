import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool12MathematicsIntegralTopic =
  defineSubjectMaterialTopic({
    slug: "integral",
    translations: {
      en: {
        description:
          "Process of calculating area and accumulating data from continuous functions.",
        title: "Integrals",
      },
      id: {
        description:
          "Proses menghitung area dan pengumpulan data dari fungsi yang berlanjut.",
        title: "Integral",
      },
    },
    sections: [
      {
        slug: "definition-of-indefinite-integral",
        translations: {
          en: {
            title: "Definition of Indefinite Integral",
          },
          id: {
            title: "Definisi Integral Tak Tentu",
          },
        },
      },
      {
        slug: "properties-of-indefinite-integral",
        translations: {
          en: {
            title: "Properties of Indefinite Integral",
          },
          id: {
            title: "Sifat-Sifat Integral Tak Tentu",
          },
        },
      },
      {
        slug: "riemann-sum",
        translations: {
          en: {
            title: "Riemann Sum",
          },
          id: {
            title: "Jumlahan Riemann",
          },
        },
      },
      {
        slug: "definite-integral",
        translations: {
          en: {
            title: "Definite Integral",
          },
          id: {
            title: "Integral Tentu",
          },
        },
      },
      {
        slug: "properties-of-definite-integral",
        translations: {
          en: {
            title: "Properties of Definite Integral",
          },
          id: {
            title: "Sifat-Sifat Integral Tentu",
          },
        },
      },
      {
        slug: "fundamental-theorem-of-calculus",
        translations: {
          en: {
            title: "Fundamental Theorem of Calculus",
          },
          id: {
            title: "Teorema Dasar Kalkulus",
          },
        },
      },
      {
        slug: "area-of-a-flat-surface",
        translations: {
          en: {
            title: "Area of a Flat Surface",
          },
          id: {
            title: "Luas Bidang Datar",
          },
        },
      },
      {
        slug: "integral-in-economics-and-business",
        translations: {
          en: {
            title: "Integral in Economics and Business",
          },
          id: {
            title: "Integral dalam Bidang Ekonomi dan Bisnis",
          },
        },
      },
      {
        slug: "integral-in-physics",
        translations: {
          en: {
            title: "Integral in Physics",
          },
          id: {
            title: "Integral dalam Bidang Fisika",
          },
        },
      },
    ],
  });
