import { getMaterialIcon } from "@/lib/utils/subject/material";

const BASE_PATH = "/subject/university";

export function getSubjects(label: "bachelor" | "master") {
  return [
    {
      icon: getMaterialIcon("ai-ds"),
      label: "ai-ds",
      href: `${BASE_PATH}/${label}/ai-ds`,
    },
    {
      icon: getMaterialIcon("game-engineering"),
      label: "game-engineering",
      href: `${BASE_PATH}/${label}/game-engineering`,
    },
  ] as const;
}

export const bachelorSubjects = getSubjects("bachelor");
