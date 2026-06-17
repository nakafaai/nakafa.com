import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsMatrixMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/matrix",
  domain: "mathematics",
  key: "lesson.mathematics.matrix",
  kind: "lesson",
  slug: "matrix",
  routeSlugs: { en: "matrix", id: "matriks" },
  translations: {
    en: {
      description:
        "Learn cofactor expansion for matrix determinants through minors, cofactors, and clear calculation examples.",
      title: "Matrix",
    },
    id: {
      description:
        "Pelajari metode ekspansi kofaktor untuk menghitung determinan matriks. Pahami minor, kofaktor, dan perhitungan determinan dengan contoh.",
      title: "Matriks",
    },
  },
  sections: [
    {
      slug: "cofactor-expansion-method",
      routeSlugs: {
        en: "cofactor-expansion-method",
        id: "metode-ekspansi-kofaktor",
      },
      translations: {
        en: {
          title: "Cofactor Expansion Method",
        },
        id: {
          title: "Metode Ekspansi Kofaktor",
        },
      },
    },
    {
      slug: "matrix-addition",
      routeSlugs: { en: "matrix-addition", id: "penjumlahan-matriks" },
      translations: {
        en: {
          title: "Matrix Addition",
        },
        id: {
          title: "Penjumlahan Matriks",
        },
      },
    },
    {
      slug: "matrix-concept",
      routeSlugs: { en: "matrix-concept", id: "konsep-matriks" },
      translations: {
        en: {
          title: "Matrix Concept",
        },
        id: {
          title: "Konsep Matriks",
        },
      },
    },
    {
      slug: "matrix-determinant",
      routeSlugs: { en: "matrix-determinant", id: "determinan-matriks" },
      translations: {
        en: {
          title: "Matrix Determinant",
        },
        id: {
          title: "Determinan Matriks",
        },
      },
    },
    {
      slug: "matrix-equality",
      routeSlugs: { en: "matrix-equality", id: "kesamaan-dua-matriks" },
      translations: {
        en: {
          title: "Matrix Equality",
        },
        id: {
          title: "Kesamaan Dua Matriks",
        },
      },
    },
    {
      slug: "matrix-inverse",
      routeSlugs: { en: "matrix-inverse", id: "invers-matriks" },
      translations: {
        en: {
          title: "Matrix Inverse",
        },
        id: {
          title: "Invers Matriks",
        },
      },
    },
    {
      slug: "matrix-multiplication",
      routeSlugs: { en: "matrix-multiplication", id: "perkalian-matriks" },
      translations: {
        en: {
          title: "Matrix Multiplication",
        },
        id: {
          title: "Perkalian Matriks",
        },
      },
    },
    {
      slug: "matrix-scalar-multiplication",
      routeSlugs: {
        en: "matrix-scalar-multiplication",
        id: "perkalian-matriks-dengan-skalar",
      },
      translations: {
        en: {
          title: "Matrix Scalar Multiplication",
        },
        id: {
          title: "Perkalian Matriks dengan Skalar",
        },
      },
    },
    {
      slug: "matrix-subtraction",
      routeSlugs: { en: "matrix-subtraction", id: "pengurangan-matriks" },
      translations: {
        en: {
          title: "Matrix Subtraction",
        },
        id: {
          title: "Pengurangan Matriks",
        },
      },
    },
    {
      slug: "matrix-transpose",
      routeSlugs: { en: "matrix-transpose", id: "matriks-transpos" },
      translations: {
        en: {
          title: "Matrix Transpose",
        },
        id: {
          title: "Matriks Transpos",
        },
      },
    },
    {
      slug: "matrix-types",
      routeSlugs: { en: "matrix-types", id: "jenis-jenis-matriks" },
      translations: {
        en: {
          title: "Matrix Types",
        },
        id: {
          title: "Jenis-Jenis Matriks",
        },
      },
    },
    {
      slug: "properties-determinant-matrix",
      routeSlugs: {
        en: "properties-determinant-matrix",
        id: "sifat-determinan-matriks",
      },
      translations: {
        en: {
          title: "Properties of Matrix Determinant",
        },
        id: {
          title: "Sifat Determinan Matriks",
        },
      },
    },
    {
      slug: "sarrus-method",
      routeSlugs: { en: "sarrus-method", id: "metode-sarrus" },
      translations: {
        en: {
          title: "Sarrus Method",
        },
        id: {
          title: "Metode Sarrus",
        },
      },
    },
  ],
});
