import type { Grade } from "@repo/contents/_types/subject/grade";

const BASE_PATH = "/subject/middle-school";

const subjects = [
  {
    grade: ["7", "8", "9"],
    label: "mathematics",
  },
] as const;

export function getSubjects(grade: Grade) {
  const grades = new Set(["7", "8", "9"]);

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
