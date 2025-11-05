import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const BASE_PATH = "/exercises/high-school";

const subjects = [
  {
    type: ["tka"],
    icon: getMaterialIcon("mathematics"),
    label: "mathematics",
  },
] as const;

export function getSubjects(type: ExercisesType) {
  const types = new Set<ExercisesType>(["tka"]);

  if (!types.has(type)) {
    return [];
  }

  return subjects
    .filter((subject) => subject.type.includes(type))
    .map((subject) => ({
      icon: subject.icon,
      label: subject.label,
      href: `${BASE_PATH}/${type}/${subject.label}`,
    }));
}
