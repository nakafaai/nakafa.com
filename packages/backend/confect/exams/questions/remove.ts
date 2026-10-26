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
 * Deletes one question's row. Each document the question owns, its prompt, rubric, and
 * explanation, is deleted by the one owner of document deletion, which works through the
 * document's rows in pages, each in a scheduled call of its own, so this transaction stays
 * small whatever the documents' history (ADR 0028). The exam's order is the caller's to keep.
 */
export const dropQuestion = Effect.fn("exams.question.drop")(function* (
  question: Pick<
    ExamQuestionsDoc,
    "_id" | "explanation" | "prompt" | "rubric"
  >
) {
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .delete(question._id)
    .pipe(Effect.orDie);
  const scheduler = yield* Scheduler;
  yield* Effect.forEach(
    [question.prompt, question.rubric, question.explanation],
    (documentId) =>
      scheduler.runAfter(
        Duration.zero,
        refs.internal.editor.deletion.document,
        {
          documentId,
        }
      ),
    { discard: true }
  );
});

/**
 * Removes one question of an exam with its documents (`dropQuestion`), and takes it out of the
 * exam's order. An exam keeps at least one question, so the last question is refused as
 * `ExamEmpty` before anything is written. Returns the order that is left.
 */
export const removeQuestion = Effect.fn("exams.question.remove")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions">,
  question: ExamQuestionsDoc
) {
  if (exam.questions.length <= 1) {
    return yield* new ExamEmpty();
  }
  yield* dropQuestion(question);
  const questions = Arr.filter(exam.questions, (id) => id !== question._id);
  yield* (yield* DatabaseWriter)
    .table("exams")
    .patch(exam._id, { questions })
    .pipe(Effect.orDie);
  return { questions };
});
