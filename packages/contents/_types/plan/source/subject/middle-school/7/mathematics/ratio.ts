import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectMiddleSchool7MathematicsRatioTopic = defineSubjectPlanTopic(
  {
    slug: "ratio",
    translations: {
      en: {
        description:
          "Read comparisons, equivalent ratios, scale, and unit rates step by step.",
        title: "Ratio",
      },
      id: {
        description:
          "Membaca perbandingan, rasio ekuivalen, skala, dan laju satuan secara bertahap.",
        title: "Rasio",
      },
    },
    sections: [
      {
        slug: "what-is-ratio",
        translations: {
          en: {
            title: "What is Ratio?",
          },
          id: {
            title: "Apa itu Rasio?",
          },
        },
      },
      {
        slug: "ratio-vs-fraction",
        translations: {
          en: {
            title: "Ratio vs Fraction",
          },
          id: {
            title: "Perbedaan Rasio dan Pecahan",
          },
        },
      },
      {
        slug: "scale-equivalent-ratio",
        translations: {
          en: {
            title: "Scale and Equivalent Ratios",
          },
          id: {
            title: "Skala dan Rasio Ekuivalen",
          },
        },
      },
      {
        slug: "unit-rate-change",
        translations: {
          en: {
            title: "Unit Rate of Change",
          },
          id: {
            title: "Laju Perubahan Satuan",
          },
        },
      },
    ],
  }
);
