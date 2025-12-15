import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from ".";

const idMaterials: ExercisesMaterialList = [
  {
    title: "Semester 1",
    description:
      "Kumpulan latihan soal untuk memperkuat pemahaman dan persiapan menghadapi ujian.",
    href: `${BASE_PATH}/semester-1`,
    items: [
      {
        title: "Set 1",
        href: `${BASE_PATH}/semester-1/set-1`,
      },
    ],
  },
] as const;

export default idMaterials;
