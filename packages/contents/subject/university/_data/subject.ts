import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";

const BASE_PATH = "/subject/university";

const subjects: Array<{
  grade: readonly Grade[];
  label: Material;
}> = [
  {
    grade: ["bachelor"],
    label: "ai-ds",
  },
  {
    grade: ["bachelor"],
    label: "game-engineering",
  },
  {
    grade: ["bachelor"],
    label: "computer-science",
  },
  {
    grade: ["bachelor"],
    label: "informatics-engineering",
  },
  {
    grade: ["bachelor"],
    label: "technology-electro-medical",
  },
  {
    grade: ["bachelor"],
    label: "political-science",
  },
  {
    grade: ["bachelor"],
    label: "international-relations",
  },
];

export function getSubjects(grade: Grade) {
  const grades = new Set(["bachelor"]);

  if (!grades.has(grade)) {
    return [];
  }

  return subjects
    .filter((subject) => (subject.grade as readonly Grade[]).includes(grade))
    .map((subject) => ({
      label: subject.label,
      href: `${BASE_PATH}/${grade}/${subject.label}`,
    }));
}
