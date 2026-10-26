import { Id } from "@repo/backend/confect/_generated/id";
import { QUESTION_POINTS_MAX } from "@repo/backend/confect/exams/question";
import { Schema } from "effect";
import { ExamResponse } from "@repo/backend/confect/exams/sittings/response";

/**
 * The verdict of one question of one attempt. A choice is `correct` or `incorrect`; an answer
 * that needs a person to judge it, such as a text or a rubric answer, stays `pending`.
 */
export const Verdict = Schema.Literals(["correct", "incorrect", "pending"]);
export type Verdict = typeof Verdict.Type;

/**
 * One scored question of one attempt. `response` holds the option IDs or the text that the attempt
 * saved (`ExamResponse`), and it chooses no option when the student left the question unanswered. `points` is the question's weight for a
 * correct answer and 0 for any other verdict, so the sum of an attempt's points is its score.
 */
export const examResultValidator = Schema.Struct({
  attempt: Id("examAttempts"),
  person: Id("tenantPeople"),
  points: Schema.Int.check(
    Schema.isBetween({ maximum: QUESTION_POINTS_MAX, minimum: 0 })
  ),
  question: Id("examQuestions"),
  response: ExamResponse,
  sitting: Id("examSittings"),
  tenantId: Id("tenants"),
  verdict: Verdict,
});
