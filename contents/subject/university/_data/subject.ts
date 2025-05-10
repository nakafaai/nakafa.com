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
    {
      icon: getMaterialIcon("computer-science"),
      label: "computer-science",
      href: `${BASE_PATH}/${label}/computer-science`,
    },
    {
      icon: getMaterialIcon("informatics-engineering"),
      label: "informatics-engineering",
      href: `${BASE_PATH}/${label}/informatics-engineering`,
    },
    {
      icon: getMaterialIcon("technology-electro-medical"),
      label: "technology-electro-medical",
      href: `${BASE_PATH}/${label}/technology-electro-medical`,
    },
    {
      icon: getMaterialIcon("political-science"),
      label: "political-science",
      href: `${BASE_PATH}/${label}/political-science`,
    },
  ] as const;
}

export const bachelorSubjects = getSubjects("bachelor");
