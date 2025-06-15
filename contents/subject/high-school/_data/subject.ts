import { getMaterialIcon } from "@/lib/utils/subject/material";
import type { Grade } from "@/types/subject/grade";

const BASE_PATH = "/subject/high-school";

const subjects = [
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("mathematics"),
    label: "mathematics",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("chemistry"),
    label: "chemistry",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("physics"),
    label: "physics",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("biology"),
    label: "biology",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("geography"),
    label: "geography",
  },

  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("economy"),
    label: "economy",
  },
  {
    grade: ["11", "12"],
    icon: getMaterialIcon("sociology"),
    label: "sociology",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("history"),
    label: "history",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("informatics"),
    label: "informatics",
  },
  {
    grade: ["10", "11", "12"],
    icon: getMaterialIcon("geospatial"),
    label: "geospatial",
  },
] as const;

export function getSubjects(grade: Grade) {
  const grades = new Set(["10", "11", "12"]);

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
