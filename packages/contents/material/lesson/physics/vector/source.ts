import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsVectorMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/vector",
  domain: "physics",
  key: "lesson.physics.vector",
  kind: "lesson",
  slug: "vector",
  translations: {
    en: {
      description:
        "Learn how to add and subtract vectors using x and y components, then determine the resultant magnitude and direction.",
      title: "Vector",
    },
    id: {
      description:
        "Pelajari cara menjumlahkan dan mengurangkan vektor dengan komponen x dan y, lalu menentukan besar serta arah resultan.",
      title: "Vektor",
    },
  },
  sections: [
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
  ],
});
