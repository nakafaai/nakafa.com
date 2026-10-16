import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ExamEmpty } from "@repo/backend/confect/exams/errors";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * Removes one question of an exam with its row, and takes it out of the exam's order.
 * Its prompt document is deleted by the one owner of document deletion, which works
 * through the document's rows in pages, each in a scheduled call of its own, so this
 * transaction stays small whatever the prompt's history (ADR 0028). An exam keeps at
 * least one question, so the last question is refused as `ExamEmpty` before anything
 * is written. Returns the order that is left.
 */
export const removeQuestion = Effect.fn("exams.question.remove")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions">,
  question: ExamQuestionsDoc
) {
  if (exam.questions.length <= 1) {
    return yield* new ExamEmpty();
  }
  const writer = yield* DatabaseWriter;
  yield* writer.table("examQuestions").delete(question._id).pipe(Effect.orDie);
  const questions = Arr.filter(exam.questions, (id) => id !== question._id);
  yield* writer
    .table("exams")
    .patch(exam._id, { questions })
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.editor.deletion.document,
    { documentId: question.prompt }
  );
  return { questions };
});
