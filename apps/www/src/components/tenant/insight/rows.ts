import type { Ref } from "@confect/core";
import type insight from "@repo/backend/confect/_generated/refs/insight";
import type { PracticeTopic } from "@repo/backend/confect/insight/schema";
import { Array as Arr } from "effect";

/** One student of a class, as Insight shows it to a teacher. */
export type InsightStudent = Ref.Returns<
  typeof insight.reads.ofClass
>["students"][number];

/** One topic of the viewer's own practice. */
export type OwnTopic = Ref.Returns<typeof insight.practice.topics>[number];

/** A rating or a chance, from 0 to 1, as a whole percent. */
export const percentOf = (share: number) => Math.round(share * 100);

/** A mean try-out score, as a whole number. */
export const scoreOf = (mean: number) => Math.round(mean);

/** A practice topic as a reader says it: the exam and its track. */
export const topicNameOf = (topic: typeof PracticeTopic.Type) =>
  Arr.join([topic.examKey, topic.trackKey], " ");

/** Each student's shared topics as one list, the row a teacher reads. */
export const practiceRowsOf = (students: readonly InsightStudent[]) =>
  Arr.flatMap(students, (student) =>
    Arr.map(student.practice, (topic) => ({
      ...topic,
      key: `${student.id}/${topicNameOf(topic)}`,
      student: student.name,
    }))
  );

/** Each student's competencies as one list, the row a teacher reads. */
export const skillRowsOf = (students: readonly InsightStudent[]) =>
  Arr.flatMap(students, (student) =>
    Arr.map(student.skills, (skill) => ({
      ...skill,
      key: `${student.id}/${skill.competency}`,
      student: student.name,
    }))
  );
