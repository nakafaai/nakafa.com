import { definePracticeMaterial } from "@repo/contents/_types/material/schema";

export const practiceAssessmentSnbtGeneralKnowledgeMaterial =
  definePracticeMaterial({
    assetRoot: "material/practice/assessment/snbt/general-knowledge",
    groups: [
      {
        exerciseType: "try-out",
        routeSlugs: { en: "tryout", id: "tryout" },
        year: 2026,
        translations: {
          en: {
            description: "Use facts and concepts for public issues.",
            title: "Try Out 2026",
          },
          id: {
            description: "Gunakan fakta dan konsep untuk isu umum.",
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
    key: "practice.assessment.snbt.general-knowledge",
    domain: "general-knowledge",
    assessment: "snbt",
  });
