import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from ".";

const enMaterials: ExercisesMaterialList = [
  {
    title: "Try Out",
    description:
      "Real exam simulation to sharpen your skills and build confidence.",
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
    ],
  },
] as const;

export default enMaterials;
