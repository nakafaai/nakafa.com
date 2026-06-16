import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsVectorOperationsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/vector-operations",
  domain: "mathematics",
  key: "lesson.mathematics.vector-operations",
  kind: "lesson",
  slug: "vector-operations",
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
