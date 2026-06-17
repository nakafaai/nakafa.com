import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsTrigonometryMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/trigonometry",
  domain: "mathematics",
  key: "lesson.mathematics.trigonometry",
  kind: "lesson",
  slug: "trigonometry",
  routeSlugs: { en: "trigonometry", id: "trigonometri" },
  translations: {
    en: {
      description:
        "Learn how to identify opposite, adjacent, and hypotenuse sides in right triangles. Learn the foundation of trigonometry with clear examples and visual guides.",
      title: "Trigonometry",
    },
    id: {
      description:
        "Pelajari cara mengidentifikasi sisi depan, samping, dan miring pada segitiga siku-siku. Pelajari dasar trigonometri dengan penjelasan jelas dan panduan visual.",
      title: "Trigonometri",
    },
  },
  sections: [
    {
      slug: "right-triangle-naming",
      routeSlugs: {
        en: "right-triangle-naming",
        id: "penamaan-sisi-segitiga-siku-siku",
      },
      translations: {
        en: {
          title: "Right Triangle Side Naming",
        },
        id: {
          title: "Penamaan Sisi Segitiga Siku-siku",
        },
      },
    },
    {
      slug: "trigonometric-comparison-sin-cos",
      routeSlugs: {
        en: "trigonometric-comparison-sin-cos",
        id: "perbandingan-trigonometri-sinus-dan-cosinus",
      },
      translations: {
        en: {
          title: "Trigonometric Comparison: Sine and Cosine",
        },
        id: {
          title: "Perbandingan Trigonometri: Sinus dan Cosinus",
        },
      },
    },
    {
      slug: "trigonometric-comparison-special-angle",
      routeSlugs: {
        en: "trigonometric-comparison-special-angle",
        id: "sudut-istimewa-perbandingan-trigonometri",
      },
      translations: {
        en: {
          title: "Special Angles in Trigonometric Comparisons",
        },
        id: {
          title: "Sudut Istimewa Perbandingan Trigonometri",
        },
      },
    },
    {
      slug: "trigonometric-comparison-tan",
      routeSlugs: {
        en: "trigonometric-comparison-tan",
        id: "perbandingan-trigonometri-tangen",
      },
      translations: {
        en: {
          title: "Trigonometric Comparison: Tangent",
        },
        id: {
          title: "Perbandingan Trigonometri: Tangen",
        },
      },
    },
    {
      slug: "trigonometric-comparison-tan-usage",
      routeSlugs: {
        en: "trigonometric-comparison-tan-usage",
        id: "kegunaan-perbandingan-trigonometri-tangen",
      },
      translations: {
        en: {
          title: "Applications of the Tangent Ratio",
        },
        id: {
          title: "Kegunaan Perbandingan Trigonometri Tangen",
        },
      },
    },
    {
      slug: "trigonometric-comparison-three-primary",
      routeSlugs: {
        en: "trigonometric-comparison-three-primary",
        id: "tiga-serangkai-perbandingan-trigonometri",
      },
      translations: {
        en: {
          title: "The Three Primary Trigonometric Comparisons",
        },
        id: {
          title: "Tiga Serangkai Perbandingan Trigonometri",
        },
      },
    },
    {
      slug: "trigonometry-concept",
      routeSlugs: { en: "trigonometry-concept", id: "konsep-trigonometri" },
      translations: {
        en: {
          title: "Trigonometry Concept",
        },
        id: {
          title: "Konsep Trigonometri",
        },
      },
    },
  ],
});
