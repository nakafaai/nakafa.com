import type { Ref } from "@confect/core";
import type insight from "@repo/backend/confect/_generated/refs/insight";
import type { PracticeTopic } from "@repo/backend/confect/insight/schema";
import { Array as Arr, Option, Schema } from "effect";

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

/** Where a student's narrative stands: not written, written, or shared with the guardians. */
export const NarrativeState = Schema.Literals(["none", "saved", "shared"]);

/** Where one student's narrative stands. */
const narrativeStateOf = ({
  narrative,
}: InsightStudent): typeof NarrativeState.Type => {
  if (narrative === null) {
    return "none";
  }
  return narrative.shared ? "shared" : "saved";
};

/** A student's mean mastery as a whole percent, and nothing while they have no points in any competency. */
const meanMasteryOf = ({ skills }: InsightStudent) =>
  Option.match(Arr.head(skills), {
    onNone: () => null,
    onSome: () =>
      percentOf(
        Arr.reduce(skills, 0, (sum, skill) => sum + skill.rating) /
          skills.length
      ),
  });

/** Each student of a class as one row, the row a teacher reads first. */
export const studentRowsOf = (students: readonly InsightStudent[]) =>
  Arr.map(students, (student) => ({
    competencies: student.skills.length,
    email: student.email,
    id: student.id,
    mastery: meanMasteryOf(student),
    name: student.name,
    state: narrativeStateOf(student),
  }));

/** Each student's shared topics as one list, the row a teacher reads. */
export const practiceRowsOf = (students: readonly InsightStudent[]) =>
  Arr.flatMap(students, (student) =>
    Arr.map(student.practice, (topic) => ({
      ...topic,
      key: `${student.id}/${topicNameOf(topic)}`,
      student: student.name,
      studentId: student.id,
    }))
  );

/** Each student's competencies as one list, the row a teacher reads. */
export const skillRowsOf = (students: readonly InsightStudent[]) =>
  Arr.flatMap(students, (student) =>
    Arr.map(student.skills, (skill) => ({
      ...skill,
      key: `${student.id}/${skill.competency}`,
      student: student.name,
      studentId: student.id,
    }))
  );
