import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsVectorOperationsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/vector-operations",
  domain: "mathematics",
  key: "lesson.mathematics.vector-operations",
  kind: "lesson",
  slug: "vector-operations",
  routeSlugs: { en: "vector-operations", id: "vektor-dan-operasinya" },
  translations: {
    en: {
      description:
        "Learn column and row vector notation, transpose operations, unit vectors in Cartesian systems, and their applications in linear algebra calculations.",
      title: "Vector and Operations",
    },
    id: {
      description:
        "Pelajari notasi vektor kolom dan baris, operasi transpos, vektor satuan dalam sistem Kartesius, dan aplikasinya dalam perhitungan aljabar linear.",
      title: "Vektor dan Operasinya",
    },
  },
  sections: [
    {
      slug: "column-row-vector",
      routeSlugs: {
        en: "column-row-vector",
        id: "vektor-kolom-dan-vektor-baris",
      },
      translations: {
        en: {
          title: "Column and Row Vectors",
        },
        id: {
          title: "Vektor Kolom dan Vektor Baris",
        },
      },
    },
    {
      slug: "equivalent-vector",
      routeSlugs: { en: "equivalent-vector", id: "vektor-ekuivalen" },
      translations: {
        en: {
          title: "Equivalent Vectors",
        },
        id: {
          title: "Vektor Ekuivalen",
        },
      },
    },
    {
      slug: "opposite-vector",
      routeSlugs: { en: "opposite-vector", id: "vektor-berkebalikan" },
      translations: {
        en: {
          title: "Reciprocal Vector",
        },
        id: {
          title: "Vektor Berkebalikan",
        },
      },
    },
    {
      slug: "position-vector",
      routeSlugs: { en: "position-vector", id: "vektor-posisi" },
      translations: {
        en: {
          title: "Position Vector",
        },
        id: {
          title: "Vektor Posisi",
        },
      },
    },
    {
      slug: "scalar-multiplication",
      routeSlugs: {
        en: "scalar-multiplication",
        id: "perkalian-skalar-vektor",
      },
      translations: {
        en: {
          title: "Scalar Vector Multiplication",
        },
        id: {
          title: "Perkalian Skalar Vektor",
        },
      },
    },
    {
      slug: "three-dimensional-vector",
      routeSlugs: { en: "three-dimensional-vector", id: "vektor-tiga-dimensi" },
      translations: {
        en: {
          title: "Three-Dimensional Vector",
        },
        id: {
          title: "Vektor Tiga Dimensi",
        },
      },
    },
    {
      slug: "two-dimensional-vector",
      routeSlugs: { en: "two-dimensional-vector", id: "vektor-dua-dimensi" },
      translations: {
        en: {
          title: "Two-Dimensional Vector",
        },
        id: {
          title: "Vektor Dua Dimensi",
        },
      },
    },
    {
      slug: "unit-vector",
      routeSlugs: { en: "unit-vector", id: "vektor-satuan-dari-suatu-vektor" },
      translations: {
        en: {
          title: "Unit Vector from a Vector",
        },
        id: {
          title: "Vektor Satuan dari Suatu Vektor",
        },
      },
    },
    {
      slug: "vector-addition",
      routeSlugs: { en: "vector-addition", id: "penjumlahan-vektor" },
      translations: {
        en: {
          title: "Vector Addition",
        },
        id: {
          title: "Penjumlahan Vektor",
        },
      },
    },
    {
      slug: "vector-components",
      routeSlugs: { en: "vector-components", id: "komponen-vektor" },
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
      slug: "vector-concept",
      routeSlugs: { en: "vector-concept", id: "konsep-vektor" },
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
      slug: "vector-coordinate-system",
      routeSlugs: {
        en: "vector-coordinate-system",
        id: "vektor-dan-sistem-koordinat",
      },
      translations: {
        en: {
          title: "Vectors and Coordinate System",
        },
        id: {
          title: "Vektor dan Sistem Koordinat",
        },
      },
    },
    {
      slug: "vector-subtraction",
      routeSlugs: { en: "vector-subtraction", id: "pengurangan-vektor" },
      translations: {
        en: {
          title: "Vector Subtraction",
        },
        id: {
          title: "Pengurangan Vektor",
        },
      },
    },
    {
      slug: "vector-types",
      routeSlugs: { en: "vector-types", id: "jenis-jenis-vektor" },
      translations: {
        en: {
          title: "Vector Types",
        },
        id: {
          title: "Jenis-jenis Vektor",
        },
      },
    },
    {
      slug: "zero-vector",
      routeSlugs: { en: "zero-vector", id: "vektor-nol" },
      translations: {
        en: {
          title: "Zero Vector",
        },
        id: {
          title: "Vektor Nol",
        },
      },
    },
  ],
});
