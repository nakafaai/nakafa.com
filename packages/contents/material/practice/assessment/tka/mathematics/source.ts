import { definePracticeMaterial } from "@repo/contents/_types/material/schema";

export const practiceAssessmentTkaMathematicsMaterial = definePracticeMaterial({
  assetRoot: "material/practice/assessment/tka/mathematics",
  groups: [
    {
      exerciseType: "try-out",
      year: 2026,
      translations: {
        en: {
          description:
            "Real exam simulation to sharpen your skills and build confidence.",
          title: "Try Out 2026",
        },
        id: {
          description:
            "Simulasi ujian nyata untuk mengasah kemampuan dan kepercayaan diri.",
          title: "Try Out 2026",
        },
      },
      sets: [
        {
          slug: "set-1",
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
