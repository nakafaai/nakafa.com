import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsGeometricTransformationMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/geometric-transformation",
    domain: "mathematics",
    key: "lesson.mathematics.geometric-transformation",
    kind: "lesson",
    slug: "geometric-transformation",
    translations: {
      en: {
        description:
          "Learn composite transformation matrices with worked examples. Combine reflections, rotations, and dilations using matrix multiplication.",
        title: "Geometric Transformation",
      },
      id: {
        description:
          "Pelajari matriks transformasi komposisi dengan contoh perhitungan. Gabungkan refleksi, rotasi, dan dilatasi menggunakan perkalian matriks.",
        title: "Transformasi Geometri",
      },
    },
    sections: [
      {
        slug: "composite-transformation-matrix",
        translations: {
          en: {
            title: "Composite Transformation Matrix",
          },
          id: {
            title: "Matriks Transformasi Komposisi",
          },
        },
      },
      {
        slug: "dilation",
        translations: {
          en: {
            title: "Dilation",
          },
          id: {
            title: "Dilatasi",
          },
        },
      },
      {
        slug: "dilation-matrix",
        translations: {
          en: {
            title: "Dilation Matrix",
          },
          id: {
            title: "Matriks Dilatasi",
          },
        },
      },
      {
        slug: "matrix-transformation",
        translations: {
          en: {
            title: "Matrix and Transformation Connection",
          },
          id: {
            title: "Kaitan Matriks dengan Transformasi",
          },
        },
      },
      {
        slug: "reflection-matrix",
        translations: {
          en: {
            title: "Reflection Matrix",
          },
          id: {
            title: "Matriks Pencerminan",
          },
        },
      },
      {
        slug: "reflection-matrix-arbitrary-point",
        translations: {
          en: {
            title: "Reflection Matrix over Arbitrary Point",
          },
          id: {
            title: "Matriks Pencerminan terhadap Sebarang Titik",
          },
        },
      },
      {
        slug: "reflection-matrix-center",
        translations: {
          en: {
            title: "Reflection Matrix over Center Point",
          },
          id: {
            title: "Matriks Pencerminan terhadap Titik Pusat",
          },
        },
      },
      {
        slug: "reflection-over-line",
        translations: {
          en: {
            title: "Reflection over a Line",
          },
          id: {
            title: "Pencerminan terhadap Garis",
          },
        },
      },
      {
        slug: "reflection-over-point",
        translations: {
          en: {
            title: "Reflection over Point",
          },
          id: {
            title: "Pencerminan terhadap Titik",
          },
        },
      },
      {
        slug: "reflection-over-x-axis",
        translations: {
          en: {
            title: "Reflection over the Horizontal Axis",
          },
          id: {
            title: "Pencerminan terhadap Sumbu Horizontal",
          },
        },
      },
      {
        slug: "reflection-over-x-equals-k",
        translations: {
          en: {
            title: "Reflection over a Vertical Line",
          },
          id: {
            title: "Pencerminan terhadap Garis Vertikal",
          },
        },
      },
      {
        slug: "reflection-over-y-axis",
        translations: {
          en: {
            title: "Reflection over the Vertical Axis",
          },
          id: {
            title: "Pencerminan terhadap Sumbu Vertikal",
          },
        },
      },
      {
        slug: "reflection-over-y-equals-h",
        translations: {
          en: {
            title: "Reflection over a Horizontal Line",
          },
          id: {
            title: "Pencerminan terhadap Garis Horizontal",
          },
        },
      },
      {
        slug: "reflection-over-y-equals-minus-x",
        translations: {
          en: {
            title: "Reflection over the Negative Diagonal Line",
          },
          id: {
            title: "Pencerminan terhadap Garis Diagonal Negatif",
          },
        },
      },
      {
        slug: "reflection-over-y-equals-x",
        translations: {
          en: {
            title: "Reflection over the Main Diagonal Line",
          },
          id: {
            title: "Pencerminan terhadap Garis Diagonal Utama",
          },
        },
      },
      {
        slug: "rotation",
        translations: {
          en: {
            title: "Rotation",
          },
          id: {
            title: "Rotasi",
          },
        },
      },
      {
        slug: "rotation-matrix",
        translations: {
          en: {
            title: "Rotation Matrix",
          },
          id: {
            title: "Matriks Rotasi",
          },
        },
      },
      {
        slug: "translation",
        translations: {
          en: {
            title: "Translation",
          },
          id: {
            title: "Translasi",
          },
        },
      },
      {
        slug: "translation-matrix",
        translations: {
          en: {
            title: "Translation Matrix",
          },
          id: {
            title: "Matriks Translasi",
          },
        },
      },
    ],
  });
