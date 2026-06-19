import { definePracticeMaterial } from "@repo/contents/_types/material/schema";

export const practiceAssessmentTkaMathematicsMaterial = definePracticeMaterial({
  assetRoot: "material/practice/assessment/tka/mathematics",
  groups: [
    {
      exerciseType: "try-out",
      routeSlugs: { en: "tryout", id: "tryout" },
      year: 2026,
      translations: {
        en: {
          description: "Solve TKA math with reasoning and strategy.",
          title: "Try Out 2026",
        },
        id: {
          description: "Pecahkan soal TKA dengan strategi matematika.",
          title: "Try Out 2026",
        },
      },
      sets: [
        {
          slug: "set-1",
          routeSlugs: { en: "set-1", id: "set-1" },
          translations: {
            en: {
              title: "Set 1",
            },
            id: {
              title: "Set 1",
            },
          },
        },
        {
          slug: "set-2",
          routeSlugs: { en: "set-2", id: "set-2" },
          translations: {
            en: {
              title: "Set 2",
            },
            id: {
              title: "Set 2",
            },
          },
        },
        {
          slug: "set-3",
          routeSlugs: { en: "set-3", id: "set-3" },
          translations: {
            en: {
              title: "Set 3",
            },
            id: {
              title: "Set 3",
            },
          },
        },
      ],
    },
  ],
  kind: "practice",
  key: "practice.assessment.tka.mathematics",
  domain: "mathematics",
  assessment: "tka",
});
