import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { questionView } from "@repo/backend/confect/exams/question";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { optionIdsOf } from "@repo/backend/confect/exams/results/stats";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import { Effect } from "effect";

/** One question of the exam, numbered from one, with the option IDs of its choice in order. */
const questionSummary = Effect.fn("exams.results.overview.question")(function* (
  questionId: ExamQuestionsDoc["_id"],
  number: number
) {
  const row = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const view = yield* questionView(row);
  return { id: questionId, number, optionIds: optionIdsOf(view.answers) };
});

/**
 * The results screen's first read: the sitting, its questions in their order with the options of each,
 * and when its results were released, or `null` while they are not. The questions are bounded by the
 * exam's own limit.
 */
export const overview = Effect.fn("exams.results.overview")(function* () {
  const sitting = yield* ResultSitting;
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  return {
    questions: yield* Effect.forEach(
      exam.questions,
      (questionId, index) => questionSummary(questionId, index + 1),
      { concurrency: "unbounded" }
    ),
    releasedAt: sitting.resultsReleasedAt ?? null,
    sitting: yield* sittingView(sitting, exam),
  };
});
