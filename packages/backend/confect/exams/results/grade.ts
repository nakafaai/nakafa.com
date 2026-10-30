import type {
  ExamAttemptsDoc,
  ExamQuestionsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import {
  PointsAboveWeight,
  ResultNotFound,
} from "@repo/backend/confect/exams/results/errors";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import { gradeVerdict } from "@repo/backend/confect/exams/results/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Gives one scored answer of a submitted attempt the points the teacher decides, as a teacher marks a
 * paper (K6, K7): an essay or a short answer that waits for the teacher, or any answer the teacher
 * judges again. The verdict follows the points (`gradeVerdict`), the student's score is the sum of the
 * points, and each grade is journaled under the sitting with the Person who gave it. An answer the
 * sitting does not hold is refused as `ResultNotFound`, and more points than the question is worth as
 * `PointsAboveWeight`.
 */
export const grade = Effect.fn("exams.results.grade")(function* (args: {
  readonly attemptId: ExamAttemptsDoc["_id"];
  readonly points: number;
  readonly questionId: ExamQuestionsDoc["_id"];
}) {
  const sitting = yield* ResultSitting;
  const member = yield* Member;
  const reader = yield* DatabaseReader;
  const attempt = yield* reader
    .table("examAttempts")
    .get(args.attemptId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  if (Option.isNone(attempt) || attempt.value.sitting !== sitting._id) {
    return yield* new ResultNotFound();
  }
  const rows = yield* attemptResults(sitting._id, attempt.value.person);
  const row = Arr.findFirst(
    rows,
    (result) =>
      result.attempt === attempt.value._id &&
      result.question === args.questionId
  );
  if (Option.isNone(row)) {
    return yield* new ResultNotFound();
  }
  // The exam takes changes while it runs (ADR 0031), so a result can outlive its question.
  const question = yield* reader
    .table("examQuestions")
    .get(args.questionId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () => Effect.fail(new ResultNotFound()),
      })
    );
  if (args.points > question.points) {
    return yield* new PointsAboveWeight();
  }
  yield* (yield* DatabaseWriter)
    .table("examResults")
    .patch(row.value._id, {
      points: args.points,
      verdict: gradeVerdict(args.points, question.points),
    })
    .pipe(Effect.orDie);
  yield* resultAuthority.record(personActor(member.person), sitting, {
    attempt: attempt.value._id,
    points: args.points,
    question: args.questionId,
    type: "exam.results.graded",
  });
  return null;
});
