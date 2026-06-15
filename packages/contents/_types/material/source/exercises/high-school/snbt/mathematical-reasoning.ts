import { defineExerciseMaterial } from "@repo/contents/_types/material/schema";

export const exercisesHighSchoolSnbtMathematicalReasoningMaterial =
  defineExerciseMaterial({
    baseRoute: "exercises/high-school/snbt/mathematical-reasoning",
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
          {
            slug: "set-4",
            translations: {
              en: {
                title: "Set 4",
              },
              id: {
                title: "Set 4",
              },
            },
          },
          {
            slug: "set-5",
            translations: {
              en: {
                title: "Set 5",
              },
              id: {
                title: "Set 5",
              },
            },
          },
          {
            slug: "set-6",
            translations: {
              en: {
                title: "Set 6",
              },
              id: {
                title: "Set 6",
              },
            },
          },
          {
            slug: "set-7",
            translations: {
              en: {
                title: "Set 7",
              },
              id: {
                title: "Set 7",
              },
            },
          },
        ],
      },
    ],
    kind: "exercise",
    key: "exercises.high-school.snbt.mathematical-reasoning",
    material: "mathematical-reasoning",
    type: "snbt",
  });
