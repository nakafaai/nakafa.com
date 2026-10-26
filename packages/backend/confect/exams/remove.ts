import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireUnfrozen } from "@repo/backend/confect/exams/freeze";
import { dropQuestion } from "@repo/backend/confect/exams/questions/remove";
import { Duration, Effect } from "effect";

/**
 * Deletes a draft exam with everything it owns: each question with the documents it owns
 * (`dropQuestion`), then the exam's row, then its images. A scheduled exam is frozen, and its
 * sittings and results score its paper, so it is refused as `ExamFrozen` before anything is
 * written. An exam holds at most `MAX_EXAM_QUESTIONS` questions, so this transaction reads and
 * deletes at most that many rows and schedules three document deletions for each. Its images
 * have no such bound, so the scheduled image sweep deletes them in pages once the row is gone.
 */
export const removeExam = Effect.fn("exams.exam.remove")(function* (
  exam: Pick<ExamsDoc, "_id" | "frozenAt" | "questions">
) {
  yield* requireUnfrozen(exam);
  const reader = yield* DatabaseReader;
  yield* Effect.forEach(
    exam.questions,
    (questionId) =>
      reader
        .table("examQuestions")
        .get(questionId)
        .pipe(Effect.orDie, Effect.flatMap(dropQuestion)),
    { discard: true }
  );
  yield* (yield* DatabaseWriter)
    .table("exams")
    .delete(exam._id)
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.exams.assets.sweep,
    { examId: exam._id }
  );
});
