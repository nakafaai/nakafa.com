import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const BASE_PATH = "/exercises/high-school";

const subjects = [
  {
    type: ["tka"],
    label: "mathematics",
  },
  {
    type: ["snbt"],
    label: "quantitative-knowledge",
  },
  {
    type: ["snbt"],
    label: "mathematical-reasoning",
  },
] as const;

export function getSubjects(type: ExercisesType) {
  const types = new Set<ExercisesType>(["tka", "snbt"]);

  if (!types.has(type)) {
    return [];
  }

  return subjects
    .filter((subject) =>
      (subject.type as readonly ExercisesType[]).includes(type)
    )
    .map((subject) => ({
      label: subject.label,
      href: `${BASE_PATH}/${type}/${subject.label}`,
    }));
}
