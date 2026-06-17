import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsVectorMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/vector",
  domain: "physics",
  key: "lesson.physics.vector",
  kind: "lesson",
  slug: "vector",
  routeSlugs: { en: "vector", id: "vektor" },
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
      routeSlugs: {
        en: "analytical-addition-subtraction",
        id: "penjumlahan-dan-pengurangan-vektor-dengan-metode-analitis",
      },
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
      routeSlugs: { en: "component", id: "komponen-vektor" },
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
      routeSlugs: { en: "concept", id: "konsep-vektor" },
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
      routeSlugs: {
        en: "cosine-rule",
        id: "penentuan-resultan-vektor-dengan-rumus-kosinus",
      },
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
      routeSlugs: {
        en: "graphical-addition-subtraction",
        id: "penjumlahan-dan-pengurangan-vektor-dengan-metode-grafis",
      },
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
      routeSlugs: { en: "multiplication", id: "perkalian-vektor" },
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
      routeSlugs: { en: "notation", id: "lambang-dan-notasi-vektor" },
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
      routeSlugs: { en: "property", id: "sifat-sifat-vektor" },
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
      routeSlugs: {
        en: "sine-rule",
        id: "penentuan-arah-resultan-vektor-dengan-rumus-sinus",
      },
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
      routeSlugs: {
        en: "trigonometry-decomposition",
        id: "penguraian-vektor-berdasarkan-aturan-trigonometri",
      },
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
