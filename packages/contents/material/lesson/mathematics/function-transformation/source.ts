import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsFunctionTransformationMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/function-transformation",
    domain: "mathematics",
    key: "lesson.mathematics.function-transformation",
    kind: "lesson",
    slug: "function-transformation",
    routeSlugs: { en: "function-transformation", id: "transformasi-fungsi" },
    translations: {
      en: {
        description: "Combine shifts, stretches, and reflections in order.",
        title: "Function Transformation",
      },
      id: {
        description: "Gabungkan geser, regang, dan cermin sesuai urutan.",
        title: "Transformasi Fungsi",
      },
    },
    sections: [
      {
        slug: "combined-transformation-function",
        routeSlugs: {
          en: "combined-transformation-function",
          id: "kombinasi-transformasi-fungsi",
        },
        translations: {
          en: {
            title: "Combined Function Transformations",
          },
          id: {
            title: "Kombinasi Transformasi Fungsi",
          },
        },
      },
      {
        slug: "horizontal-dilation",
        routeSlugs: { en: "horizontal-dilation", id: "dilatasi-horizontal" },
        translations: {
          en: {
            title: "Horizontal Dilation",
          },
          id: {
            title: "Dilatasi Horizontal",
          },
        },
      },
      {
        slug: "horizontal-reflection",
        routeSlugs: { en: "horizontal-reflection", id: "refleksi-horizontal" },
        translations: {
          en: {
            title: "Horizontal Reflection",
          },
          id: {
            title: "Refleksi Horizontal",
          },
        },
      },
      {
        slug: "horizontal-translation",
        routeSlugs: {
          en: "horizontal-translation",
          id: "translasi-horizontal",
        },
        translations: {
          en: {
            title: "Horizontal Translation",
          },
          id: {
            title: "Translasi Horizontal",
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
        slug: "vertical-dilation",
        routeSlugs: { en: "vertical-dilation", id: "dilatasi-vertikal" },
        translations: {
          en: {
            title: "Vertical Dilation",
          },
          id: {
            title: "Dilatasi Vertikal",
          },
        },
      },
      {
        slug: "vertical-reflection",
        routeSlugs: { en: "vertical-reflection", id: "refleksi-vertikal" },
        translations: {
          en: {
            title: "Vertical Reflection",
          },
          id: {
            title: "Refleksi Vertikal",
          },
        },
      },
      {
        slug: "vertical-translation",
        routeSlugs: { en: "vertical-translation", id: "translasi-vertikal" },
        translations: {
          en: {
            title: "Vertical Translation",
          },
          id: {
            title: "Translasi Vertikal",
          },
        },
      },
    ],
  });
