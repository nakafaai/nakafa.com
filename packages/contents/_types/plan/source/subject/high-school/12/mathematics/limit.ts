import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12MathematicsLimitTopic = defineSubjectPlanTopic({
  slug: "limit",
  translations: {
    en: {
      description:
        "Fundamental calculus concept analyzing function behavior as it approaches a value.",
      title: "Limits",
    },
    id: {
      description:
        "Konsep fundamental kalkulus yang menganalisis perilaku fungsi mendekati suatu nilai.",
      title: "Limit",
    },
  },
  sections: [
    {
      slug: "concept-of-limit-function",
      translations: {
        en: {
          title: "Concept of Limit Function",
        },
        id: {
          title: "Konsep Limit Fungsi",
        },
      },
    },
    {
      slug: "properties-of-limit-function",
      translations: {
        en: {
          title: "Properties of Limit Function",
        },
        id: {
          title: "Sifat Limit Fungsi",
        },
      },
    },
    {
      slug: "limit-of-algebraic-function",
      translations: {
        en: {
          title: "Limit of Algebraic Function",
        },
        id: {
          title: "Limit Fungsi Aljabar",
        },
      },
    },
    {
      slug: "limit-of-trigonometric-function",
      translations: {
        en: {
          title: "Limit of Trigonometric Function",
        },
        id: {
          title: "Limit Fungsi Trigonometri",
        },
      },
    },
    {
      slug: "application-of-limit-function",
      translations: {
        en: {
          title: "Application of Limit Function",
        },
        id: {
          title: "Aplikasi Limit Fungsi",
        },
      },
    },
  ],
});
