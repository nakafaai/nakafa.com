import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";

const BASE_PATH = "/subject/high-school";

const subjects: Array<{
  grade: readonly Grade[];
  label: Material;
}> = [
  {
    grade: ["10", "11", "12"],
    label: "mathematics",
  },
  {
    grade: ["10", "11", "12"],
    label: "physics",
  },
  {
    grade: ["10", "11", "12"],
    label: "chemistry",
  },
  {
    grade: ["10", "11", "12"],
    label: "biology",
  },
  {
    grade: ["11", "12"],
    label: "geography",
  },
  {
    grade: ["11", "12"],
    label: "economy",
  },
  {
    grade: ["11", "12"],
    label: "sociology",
  },
  {
    grade: ["10", "11", "12"],
    label: "history",
  },
  {
    grade: ["10", "11", "12"],
    label: "informatics",
  },
  {
    grade: ["10", "11", "12"],
    label: "geospatial",
  },
];

export function getSubjects(grade: Grade) {
  const grades = new Set(["10", "11", "12"]);

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
