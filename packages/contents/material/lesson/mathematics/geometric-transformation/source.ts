import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsGeometricTransformationMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/geometric-transformation",
    domain: "mathematics",
    key: "lesson.mathematics.geometric-transformation",
    kind: "lesson",
    slug: "geometric-transformation",
    routeSlugs: { en: "geometric-transformation", id: "transformasi-geometri" },
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
        routeSlugs: {
          en: "composite-transformation-matrix",
          id: "matriks-transformasi-komposisi",
        },
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
        routeSlugs: { en: "dilation", id: "dilatasi" },
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
        routeSlugs: { en: "dilation-matrix", id: "matriks-dilatasi" },
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
        routeSlugs: {
          en: "matrix-transformation",
          id: "kaitan-matriks-dengan-transformasi",
        },
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
        routeSlugs: { en: "reflection-matrix", id: "matriks-pencerminan" },
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
        routeSlugs: {
          en: "reflection-matrix-arbitrary-point",
          id: "matriks-pencerminan-terhadap-sebarang-titik",
        },
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
        routeSlugs: {
          en: "reflection-matrix-center",
          id: "matriks-pencerminan-terhadap-titik-pusat",
        },
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
        routeSlugs: {
          en: "reflection-over-line",
          id: "pencerminan-terhadap-garis",
        },
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
        routeSlugs: {
          en: "reflection-over-point",
          id: "pencerminan-terhadap-titik",
        },
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
        routeSlugs: {
          en: "reflection-over-x-axis",
          id: "pencerminan-terhadap-sumbu-horizontal",
        },
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
        routeSlugs: {
          en: "reflection-over-x-equals-k",
          id: "pencerminan-terhadap-garis-vertikal",
        },
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
        routeSlugs: {
          en: "reflection-over-y-axis",
          id: "pencerminan-terhadap-sumbu-vertikal",
        },
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
        routeSlugs: {
          en: "reflection-over-y-equals-h",
          id: "pencerminan-terhadap-garis-horizontal",
        },
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
        routeSlugs: {
          en: "reflection-over-y-equals-minus-x",
          id: "pencerminan-terhadap-garis-diagonal-negatif",
        },
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
        routeSlugs: {
          en: "reflection-over-y-equals-x",
          id: "pencerminan-terhadap-garis-diagonal-utama",
        },
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
        routeSlugs: { en: "rotation", id: "rotasi" },
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
        routeSlugs: { en: "rotation-matrix", id: "matriks-rotasi" },
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
        routeSlugs: { en: "translation", id: "translasi" },
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
        routeSlugs: { en: "translation-matrix", id: "matriks-translasi" },
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
