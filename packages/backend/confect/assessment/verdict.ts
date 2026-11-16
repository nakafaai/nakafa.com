import type { Grade } from "@repo/backend/confect/assessment/grade";
import { Schema } from "effect";

/**
 * The verdict of one answer to one question: `correct` earns all of the question's points, `incorrect`
 * none, and `partial` any number between, by the question's rule or a teacher's grade. An answer that
 * needs a person to judge it, such as a text or an essay, stays `pending` until it is graded. A School
 * result and a try-out review show the same verdicts.
 */
export const Verdict = Schema.Literals([
  "correct",
  "incorrect",
  "partial",
  "pending",
]);
export type Verdict = typeof Verdict.Type;

/**
 * The verdict that points give, a rule's or a teacher's: none of the question's points is `incorrect`,
 * all of them is `correct`, and any number between is `partial`.
 */
export const gradeVerdict = (points: number, weight: number): Verdict => {
  if (points === 0) {
    return "incorrect";
  }
  return points === weight ? "correct" : "partial";
};

/** The verdict of a graded answer: its score category against its ceiling, or pending while a person grades it. */
export const verdictOf = (graded: Grade): Verdict =>
  graded.status === "pending"
    ? "pending"
    : gradeVerdict(graded.category, graded.ceiling);
