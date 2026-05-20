import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from "@repo/contents/exercises/middle-school/grade-9/mathematics/_data/path";

const enMaterials = [
  {
    title: "Semester 1",
    description:
      "Practice exercises to strengthen your understanding and prepare for exams.",
    href: `${BASE_PATH}/semester-1`,
    items: [
      {
        title: "Set 1",
        href: `${BASE_PATH}/semester-1/set-1`,
      },
    ],
  },
] satisfies ExercisesMaterialList;

export default enMaterials;
