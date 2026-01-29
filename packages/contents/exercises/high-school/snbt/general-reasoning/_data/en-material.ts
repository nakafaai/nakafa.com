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
      {
        title: "Set 3",
        href: `${BASE_PATH}/try-out/set-3`,
      },
      {
        title: "Set 4",
        href: `${BASE_PATH}/try-out/set-4`,
      },
      {
        title: "Set 5",
        href: `${BASE_PATH}/try-out/set-5`,
      },
      {
        title: "Set 6",
        href: `${BASE_PATH}/try-out/set-6`,
      },
      {
        title: "Set 7",
        href: `${BASE_PATH}/try-out/set-7`,
      },
      {
        title: "Set 8",
        href: `${BASE_PATH}/try-out/set-8`,
      },
    ],
  },
] as const;

export default enMaterials;
