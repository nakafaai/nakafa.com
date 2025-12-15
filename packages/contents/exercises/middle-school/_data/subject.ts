import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const BASE_PATH = "/exercises/middle-school";

const subjects = [
  {
    type: ["grade-9"],
    label: "mathematics",
  },
] as const;

export function getSubjects(type: ExercisesType) {
  const types = new Set<ExercisesType>(["grade-9"]);

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
