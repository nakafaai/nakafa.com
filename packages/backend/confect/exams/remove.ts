import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ExamInUse } from "@repo/backend/confect/exams/errors";
import { dropQuestion } from "@repo/backend/confect/exams/questions/remove";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * Deletes an exam with everything it owns: each question with the documents it owns
 * (`dropQuestion`), then the exam's row, then its images. An exam that has a sitting, scheduled,
 * running or finished, is refused as `ExamInUse` before anything is written, because the sitting
 * and its results read it. An exam holds at most `MAX_EXAM_QUESTIONS` questions, so this transaction reads and
 * deletes at most that many rows and schedules three document deletions for each. Its images
 * have no such bound, so the scheduled image sweep deletes them in pages once the row is gone.
 */
export const removeExam = Effect.fn("exams.exam.remove")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions">
) {
  const reader = yield* DatabaseReader;
  const sittings = yield* reader
    .table("examSittings")
    .index("by_examId_and_opensAt", (query) => query.eq("examId", exam._id))
    .take(1)
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayNonEmpty(sittings)) {
    return yield* new ExamInUse();
  }
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
