import { getMaterialIcon } from "@/lib/utils/subject/material";
import type { Grade } from "@/types/subject/grade";

const BASE_PATH = "/subject/university";

const subjects = [
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("ai-ds"),
    label: "ai-ds",
  },
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("game-engineering"),
    label: "game-engineering",
  },
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("computer-science"),
    label: "computer-science",
  },
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("informatics-engineering"),
    label: "informatics-engineering",
  },
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("technology-electro-medical"),
    label: "technology-electro-medical",
  },
  {
    grade: ["bachelor"],
    icon: getMaterialIcon("political-science"),
    label: "political-science",
  },
] as const;

export function getSubjects(grade: Grade) {
  const grades = new Set(["bachelor"]);

  if (!grades.has(grade)) {
    return [];
  }

  return subjects
    .filter((subject) => (subject.grade as readonly Grade[]).includes(grade))
    .map((subject) => ({
      icon: subject.icon,
      label: subject.label,
      href: `${BASE_PATH}/${grade}/${subject.label}`,
    }));
}
