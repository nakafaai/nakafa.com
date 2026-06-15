import { defineExercisePlan } from "@repo/contents/_types/plan/schema";

export const exercisesMiddleSchoolGrade9MathematicsPlan = defineExercisePlan({
  baseRoute: "exercises/middle-school/grade-9/mathematics",
  category: "middle-school",
  groups: [
    {
      exerciseType: "semester-1",
      translations: {
        en: {
          description:
            "Practice exercises to strengthen your understanding and prepare for exams.",
          title: "Semester 1",
        },
        id: {
          description:
            "Kumpulan latihan soal untuk memperkuat pemahaman dan persiapan menghadapi ujian.",
          title: "Semester 1",
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
      ],
    },
  ],
  kind: "exercise",
  key: "exercises.middle-school.grade-9.mathematics",
  material: "mathematics",
  type: "grade-9",
});
