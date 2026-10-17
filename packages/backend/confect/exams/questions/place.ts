import type { GenericId } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { insertIndex, placeAt } from "@repo/backend/confect/exams/order";
import {
  EMPTY_PROMPT_TEXT,
  encodeAnswers,
  newChoiceAnswers,
} from "@repo/backend/confect/exams/question";
import { Clock, Effect, Option } from "effect";

/** The parts of an exam that placing a question reads and writes. */
type ExamPlace = Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">;

/**
 * Places one question row in an exam, after `after` or last, with the given answers,
 * key, and prompt, and patches the exam's order. A full exam is refused as `ExamFull`,
 * and an `after` that is not one of the exam's questions as a missing object. The
 * refusals come before the exam's order changes, and the transaction rolls back the
 * rows already written. Returns the new question's ID.
 */
export const placeQuestion = Effect.fn("exams.question.place")(function* (
  exam: ExamPlace,
  after: GenericId.GenericId<"examQuestions"> | null,
  fields: {
    readonly answers: string;
    readonly key: string | null;
    readonly prompt: GenericId.GenericId<"editorDocuments">;
  }
) {
  if (exam.questions.length >= MAX_EXAM_QUESTIONS) {
    return yield* new ExamFull();
  }
  const position = insertIndex(exam.questions, after);
  if (Option.isNone(position)) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
  const writer = yield* DatabaseWriter;
  const at = yield* Clock.currentTimeMillis;
  const questionId = yield* writer
    .table("examQuestions")
    .insert({
      answers: fields.answers,
      examId: exam._id,
      key: fields.key,
      prompt: fields.prompt,
      revision: 0,
      template: "choice",
      tenantId: exam.tenantId,
      updatedAt: at,
    })
    .pipe(Effect.orDie);
  yield* writer
    .table("exams")
    .patch(exam._id, {
      questions: placeAt(exam.questions, questionId, position.value),
    })
    .pipe(Effect.orDie);
  return questionId;
});

/**
 * Adds a new question after `after`, or last: one empty prompt document and a
 * single-answer choice with no correct option marked, so its key is null.
 */
export const addQuestion = Effect.fn("exams.question.add")(function* (
  exam: ExamPlace,
  after: GenericId.GenericId<"examQuestions"> | null
) {
  const text = yield* storedDocument(EMPTY_PROMPT_TEXT).pipe(Effect.orDie);
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text,
  });
  const answers = yield* encodeAnswers(newChoiceAnswers());
  return yield* placeQuestion(exam, after, { answers, key: null, prompt });
});
