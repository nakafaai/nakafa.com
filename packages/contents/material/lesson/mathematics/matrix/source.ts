import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsMatrixMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/matrix",
  domain: "mathematics",
  key: "lesson.mathematics.matrix",
  kind: "lesson",
  slug: "matrix",
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
