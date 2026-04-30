import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from "@repo/contents/exercises/high-school/tka/mathematics/_data";

const enMaterials: ExercisesMaterialList = [
  {
    title: "Try Out 2026",
    description:
      "Real exam simulation to sharpen your skills and build confidence.",
    href: `${BASE_PATH}/try-out/2026`,
    items: [
      {
        title: "Set 1",
        href: `${BASE_PATH}/try-out/2026/set-1`,
      },
      {
        title: "Set 2",
        href: `${BASE_PATH}/try-out/2026/set-2`,
      },
      {
        title: "Set 3",
        href: `${BASE_PATH}/try-out/2026/set-3`,
      },
    ],
  },
] as const;

export default enMaterials;
