import { defineExercisePlan } from "@repo/contents/_types/plan/schema";

export const exercisesHighSchoolSnbtGeneralKnowledgePlan = defineExercisePlan({
  baseRoute: "exercises/high-school/snbt/general-knowledge",
  category: "high-school",
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
      ],
    },
  ],
  kind: "exercise",
  key: "exercises.high-school.snbt.general-knowledge",
  material: "general-knowledge",
  type: "snbt",
});
