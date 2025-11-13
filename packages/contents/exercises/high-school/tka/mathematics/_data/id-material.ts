import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from ".";

const idMaterials: ExercisesMaterialList = [
  {
    title: "Try Out",
    description:
      "Simulasi ujian nyata untuk mengasah kemampuan dan kepercayaan diri.",
    href: `${BASE_PATH}/try-out`,
    items: [
      {
        title: "Set 1",
        href: `${BASE_PATH}/try-out/set-1`,
      },
      {
        title: "Set 2",
        href: `${BASE_PATH}/try-out/set-2`,
      },
      {
        title: "Set 3",
        href: `${BASE_PATH}/try-out/set-3`,
      },
    ],
  },
] as const;

export default idMaterials;
