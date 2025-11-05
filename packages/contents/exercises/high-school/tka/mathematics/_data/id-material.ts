import type { MaterialList } from "@repo/contents/_types/exercises/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
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
    ],
  },
] as const;

export default idMaterials;
