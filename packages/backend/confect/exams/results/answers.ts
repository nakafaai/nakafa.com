import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import { questionSummary } from "@repo/backend/confect/exams/results/summary";
import { attemptIn } from "@repo/backend/confect/exams/sittings/attempt";
import { Array as Arr, Effect, Number as Num } from "effect";

/**
 * The scored answers of one Person in one sitting: each scored question of the exam in its
 * order, with its options, the response and the verdict, and the points the answers earned.
 * A question that holds no scored row of the Person is left out.
 */
export const answersOf = Effect.fn("exams.results.answers")(function* (
  sitting: ExamSittingsDoc,
  personId: TenantPeopleDoc["_id"]
) {
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  const rows = yield* attemptResults(sitting._id, personId);
  const questions = yield* Effect.forEach(
    exam.questions,
    (questionId, index) =>
      Effect.map(questionSummary(questionId, index + 1), (summary) =>
        Arr.map(
          Arr.filter(rows, (row) => row.question === questionId),
          (row) => ({
            number: index + 1,
            optionIds: summary.optionIds,
            points: summary.points,
            response: row.response,
            verdict: row.verdict,
          })
        )
      ),
    { concurrency: "unbounded" }
  );
  return {
    points: Num.sumAll(Arr.map(rows, (row) => row.points)),
    questions: Arr.flatten(questions),
  };
});

/**
 * One attempt's scored answers for the staff who read the sitting's results, so a teacher
 * reads a student's answers beside the students' list. An attempt of another sitting is
 * refused as a resource.
 */
export const attemptAnswers = Effect.fn("exams.results.attempt")(
  function* (args: { attemptId: ExamAttemptsDoc["_id"] }) {
    const sitting = yield* ResultSitting;
    const attempt = yield* attemptIn(sitting, args.attemptId, "result.view");
    return yield* answersOf(sitting, attempt.person);
  }
);
