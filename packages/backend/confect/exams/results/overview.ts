import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import { questionSummary } from "@repo/backend/confect/exams/results/summary";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import { Effect } from "effect";

/**
 * The results screen's first read: the caller's result actions, the sitting, its questions in their
 * order with the options of each, and when its results were released, or `null` while they are not.
 * The questions are bounded by the exam's own limit.
 */
export const overview = Effect.fn("exams.results.overview")(function* () {
  const sitting = yield* ResultSitting;
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  return {
    can: yield* resultAuthority.allowed(sitting),
    questions: yield* Effect.forEach(
      exam.questions,
      (questionId, index) => questionSummary(questionId, index + 1),
      { concurrency: "unbounded" }
    ),
    releasedAt: sitting.resultsReleasedAt ?? null,
    sitting: yield* sittingView(sitting, exam),
  };
});
