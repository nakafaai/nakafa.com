import { Id } from "@repo/backend/confect/_generated/id";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Verdict } from "@repo/backend/confect/assessment/verdict";
import { QUESTION_POINTS_MAX } from "@repo/backend/confect/exams/question";
import { Schema } from "effect";

/** The points one answer earns: a whole number from none to the most a question is worth. */
export const GradePoints = Schema.Int.check(
  Schema.isBetween({ maximum: QUESTION_POINTS_MAX, minimum: 0 })
);

/**
 * One scored question of one attempt. `response` holds the option IDs or the text that the attempt
 * saved (`ExamResponse`), and it chooses no option when the student left the question unanswered.
 * `points` is what the question's rule gave the answer, the teacher's grade for a graded one, and 0 while
 * it waits for a person, so the sum of an attempt's points is its score.
 */
export const examResultValidator = Schema.Struct({
  attempt: Id("examAttempts"),
  person: Id("tenantPeople"),
  points: GradePoints,
  question: Id("examQuestions"),
  response: ExamResponse,
  sitting: Id("examSittings"),
  tenantId: Id("tenants"),
  verdict: Verdict,
});
