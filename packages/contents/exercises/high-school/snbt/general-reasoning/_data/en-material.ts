import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from "@repo/contents/exercises/high-school/snbt/general-reasoning/_data";

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
      {
        title: "Set 4",
        href: `${BASE_PATH}/try-out/2026/set-4`,
      },
      {
        title: "Set 5",
        href: `${BASE_PATH}/try-out/2026/set-5`,
      },
      {
        title: "Set 6",
        href: `${BASE_PATH}/try-out/2026/set-6`,
      },
      {
        title: "Set 7",
        href: `${BASE_PATH}/try-out/2026/set-7`,
      },
      {
        title: "Set 8",
        href: `${BASE_PATH}/try-out/2026/set-8`,
      },
      {
        title: "Set 9",
        href: `${BASE_PATH}/try-out/2026/set-9`,
      },
      {
        title: "Set 10",
        href: `${BASE_PATH}/try-out/2026/set-10`,
      },
    ],
  },
] as const;

export default enMaterials;
