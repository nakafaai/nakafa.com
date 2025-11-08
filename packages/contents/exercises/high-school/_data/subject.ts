import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const BASE_PATH = "/exercises/high-school";

const subjects: Array<{
  type: readonly ExercisesType[];
  label: ExercisesMaterial;
}> = [
  {
    type: ["tka"],
    label: "mathematics",
  },
];

export function getSubjects(type: ExercisesType) {
  const types = new Set<ExercisesType>(["tka"]);

  if (!types.has(type)) {
    return [];
  }

  return subjects
    .filter((subject) => subject.type.includes(type))
    .map((subject) => ({
      label: subject.label,
      href: `${BASE_PATH}/${type}/${subject.label}`,
    }));
}
