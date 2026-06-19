import { definePracticeMaterial } from "@repo/contents/_types/material/schema";

export const practiceAssessmentSnbtIndonesianLanguageMaterial =
  definePracticeMaterial({
    assetRoot: "material/practice/assessment/snbt/indonesian-language",
    groups: [
      {
        exerciseType: "try-out",
        routeSlugs: { en: "tryout", id: "tryout" },
        year: 2026,
        translations: {
          en: {
            description: "Read Indonesian passages and refine wording.",
            title: "Try Out 2026",
          },
          id: {
            description: "Pahami bacaan Indonesia dan rapikan bahasa.",
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
        ],
      },
    ],
    kind: "practice",
    key: "practice.assessment.snbt.indonesian-language",
    domain: "indonesian-language",
    assessment: "snbt",
  });
