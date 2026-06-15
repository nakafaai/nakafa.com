import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool10MathematicsTrigonometryTopic =
  defineSubjectMaterialTopic({
    slug: "trigonometry",
    translations: {
      en: {
        description:
          "The language of triangles for building structures and exploring space.",
        title: "Trigonometry",
      },
      id: {
        description:
          "Bahasa segitiga untuk membangun gedung dan menjelajahi antariksa.",
        title: "Trigonometri",
      },
    },
    sections: [
      {
        slug: "trigonometry-concept",
        translations: {
          en: {
            title: "Trigonometry Concept",
          },
          id: {
            title: "Konsep Trigonometri",
          },
        },
      },
      {
        slug: "right-triangle-naming",
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
        slug: "trigonometric-comparison-tan",
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
        slug: "trigonometric-comparison-sin-cos",
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
        slug: "trigonometric-comparison-three-primary",
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
        slug: "trigonometric-comparison-special-angle",
        translations: {
          en: {
            title: "Special Angles in Trigonometric Comparisons",
          },
          id: {
            title: "Sudut Istimewa Perbandingan Trigonometri",
          },
        },
      },
    ],
  });
