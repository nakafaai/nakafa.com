import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { removeDocument } from "@repo/backend/confect/editor/remove";
import { ExamEmpty } from "@repo/backend/confect/exams/errors";
import { Array as Arr, Effect } from "effect";

/**
 * Removes one question of an exam with its row and its prompt document, and takes it
 * out of the exam's order. An exam keeps at least one question, so the last question
 * is refused as `ExamEmpty` before anything is written. Returns the order that is left.
 */
export const removeQuestion = Effect.fn("exams.question.remove")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions">,
  question: ExamQuestionsDoc
) {
  if (exam.questions.length <= 1) {
    return yield* new ExamEmpty();
  }
  const writer = yield* DatabaseWriter;
  yield* removeDocument(question.prompt);
  yield* writer.table("examQuestions").delete(question._id).pipe(Effect.orDie);
  const questions = Arr.filter(exam.questions, (id) => id !== question._id);
  yield* writer
    .table("exams")
    .patch(exam._id, { questions })
    .pipe(Effect.orDie);
  return { questions };
});
