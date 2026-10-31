import type { Ref } from "@confect/core";
import type insight from "@repo/backend/confect/_generated/refs/insight";
import { Array as Arr } from "effect";

/** One student of a class, as Insight shows it to a teacher. */
export type InsightStudent = Ref.Returns<
  typeof insight.reads.ofClass
>["students"][number];

/** A rating or a chance, from 0 to 1, as a whole percent. */
export const percentOf = (share: number) => Math.round(share * 100);

/** Each student's competencies as one list, the row a teacher reads. */
export const skillRowsOf = (students: readonly InsightStudent[]) =>
  Arr.flatMap(students, (student) =>
    Arr.map(student.skills, (skill) => ({
      ...skill,
      key: `${student.id}/${skill.competency}`,
      student: student.name,
    }))
  );
