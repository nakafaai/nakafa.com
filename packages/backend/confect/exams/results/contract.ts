import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Id } from "@repo/backend/confect/_generated/id";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import { Verdict } from "@repo/backend/confect/exams/results/schema";
import { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The wire contracts of the results functions. A spec imports them, so this module holds
 * declarations only: no database read and no write.
 */

/** The result actions a caller may take on a sitting: reading its results, and releasing them. */
const ResultAction = Kind.actions(entries, "result");

/** One question of the exam in its order: its number, and the option IDs of its choice in their order. */
export const QuestionSummary = Schema.Struct({
  id: Id("examQuestions"),
  number: Schema.Int.check(Schema.isGreaterThan(0)),
  optionIds: Schema.Array(LocalIdSchema),
});

/**
 * The results screen's first read: the caller's result actions, the sitting, its questions in order,
 * and when its results were released, or `null` while they are not. A release also needs the sitting
 * to be closed, which the server checks when the release is made.
 */
export const Overview = Schema.Struct({
  can: Schema.Array(ResultAction),
  questions: Schema.Array(QuestionSummary),
  releasedAt: Schema.NullOr(Schema.Finite),
  sitting: SittingView,
});

/**
 * One attempt in the students' list. Its score, answered count, and pending count are `null` until
 * the attempt is submitted and its answers are scored.
 */
export const StudentRow = Schema.Struct({
  answered: Schema.NullOr(Schema.Int),
  attemptId: Id("examAttempts"),
  name: PersonName,
  pending: Schema.NullOr(Schema.Int),
  points: Schema.NullOr(Schema.Int),
  state: AttemptState,
  submittedAt: Schema.NullOr(Schema.Finite),
});

/** One student's answer to a question, with its verdict, in the question's list. */
export const AnswerRow = Schema.Struct({
  attemptId: Id("examAttempts"),
  name: PersonName,
  response: Schema.Array(LocalIdSchema),
  verdict: Verdict,
});

/**
 * The statistics of one question across the sitting. `counted` is the number of scored answers the
 * read counted, and `complete` tells whether it counted every one of them. `optionCounts` lists each
 * option of the question in its order, with the number of answers that chose it.
 */
export const QuestionStats = Schema.Struct({
  answered: Schema.Int,
  complete: Schema.Boolean,
  correct: Schema.Int,
  counted: Schema.Int,
  incorrect: Schema.Int,
  optionCounts: Schema.Array(
    Schema.Struct({ count: Schema.Int, optionId: LocalIdSchema })
  ),
  pending: Schema.Int,
});

/**
 * One question of a student's released result: its number, the option IDs of its choice in their
 * order, the option IDs that the student chose, and the verdict. The chosen IDs are empty when the
 * student left the question unanswered.
 */
const StudentAnswer = Schema.Struct({
  number: Schema.Int.check(Schema.isGreaterThan(0)),
  optionIds: Schema.Array(LocalIdSchema),
  response: Schema.Array(LocalIdSchema),
  verdict: Verdict,
});

/**
 * A student's own released result: the points earned, and each question of the exam in its order,
 * numbered from one.
 */
export const StudentResult = Schema.Struct({
  points: Schema.Int,
  questions: Schema.Array(StudentAnswer),
});
