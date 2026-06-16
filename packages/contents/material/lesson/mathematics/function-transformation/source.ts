import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsFunctionTransformationMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/function-transformation",
    domain: "mathematics",
    key: "lesson.mathematics.function-transformation",
    kind: "lesson",
    slug: "function-transformation",
    translations: {
      en: {
        description:
          "Learn combined function transformations with worked examples. Learn vertical, horizontal transformations, order effects, and solve practice exercises.",
        title: "Function Transformation",
      },
      id: {
        description:
          "Pelajari kombinasi transformasi fungsi dengan contoh bertahap. Pelajari transformasi vertikal, horizontal, pengaruh urutan, dan kerjakan latihan soal.",
        title: "Transformasi Fungsi",
      },
    },
    sections: [
      {
        slug: "combined-transformation-function",
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
