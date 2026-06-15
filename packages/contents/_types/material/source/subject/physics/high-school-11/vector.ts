import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11PhysicsVectorTopic = defineSubjectMaterialTopic(
  {
    slug: "vector",
    translations: {
      en: {
        description:
          "Mathematical language to describe direction and magnitude in space, from GPS to gaming.",
        title: "Vectors",
      },
      id: {
        description:
          "Bahasa matematika untuk menjelaskan arah dan besaran dalam ruang, dari GPS hingga game.",
        title: "Vektor",
      },
    },
    sections: [
      {
        slug: "concept",
        translations: {
          en: {
            title: "Vector Concept",
          },
          id: {
            title: "Konsep Vektor",
          },
        },
      },
      {
        slug: "notation",
        translations: {
          en: {
            title: "Vector Symbols and Notation",
          },
          id: {
            title: "Lambang dan Notasi Vektor",
          },
        },
      },
      {
        slug: "property",
        translations: {
          en: {
            title: "Vector Properties",
          },
          id: {
            title: "Sifat-sifat Vektor",
          },
        },
      },
      {
        slug: "component",
        translations: {
          en: {
            title: "Vector Components",
          },
          id: {
            title: "Komponen Vektor",
          },
        },
      },
      {
        slug: "trigonometry-decomposition",
        translations: {
          en: {
            title: "Vector Decomposition Using Trigonometry Rules",
          },
          id: {
            title: "Penguraian Vektor Berdasarkan Aturan Trigonometri",
          },
        },
      },
      {
        slug: "graphical-addition-subtraction",
        translations: {
          en: {
            title: "Vector Addition and Subtraction with Graphical Method",
          },
          id: {
            title: "Penjumlahan dan Pengurangan Vektor dengan Metode Grafis",
          },
        },
      },
      {
        slug: "analytical-addition-subtraction",
        translations: {
          en: {
            title: "Vector Addition and Subtraction with Analytical Method",
          },
          id: {
            title: "Penjumlahan dan Pengurangan Vektor dengan Metode Analitis",
          },
        },
      },
      {
        slug: "cosine-rule",
        translations: {
          en: {
            title: "Determining Vector Resultant with Cosine Rule",
          },
          id: {
            title: "Penentuan Resultan Vektor dengan Rumus Kosinus",
          },
        },
      },
      {
        slug: "sine-rule",
        translations: {
          en: {
            title: "Determining Vector Resultant Direction with Sine Rule",
          },
          id: {
            title: "Penentuan Arah Resultan Vektor dengan Rumus Sinus",
          },
        },
      },
      {
        slug: "multiplication",
        translations: {
          en: {
            title: "Vector Multiplication",
          },
          id: {
            title: "Perkalian Vektor",
          },
        },
      },
    ],
  }
);
