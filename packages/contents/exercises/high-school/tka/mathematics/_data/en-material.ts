import type { MaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
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
    ],
  },
] as const;

export default enMaterials;
