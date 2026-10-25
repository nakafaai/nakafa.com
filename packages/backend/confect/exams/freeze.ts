import type { GenericId } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ExamFrozen } from "@repo/backend/confect/exams/errors";
import { Clock, Effect, Option } from "effect";

/**
 * Refuses a change to the questions of an exam that a sitting has scheduled. The freeze keeps the exam
 * as the sitting was scheduled, so every result scores the questions and keys that the student sat.
 */
export const requireUnfrozen = Effect.fn("exams.freeze.require")(function* (
  exam: Pick<ExamsDoc, "frozenAt">
) {
  if (exam.frozenAt !== undefined) {
    return yield* new ExamFrozen();
  }
});

/**
 * The question a document belongs to, as its prompt, its rubric, or its explanation. A document
 * that no question holds belongs to no question, so none is returned.
 */
const questionOwning = Effect.fn("exams.freeze.owner")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  const reader = yield* DatabaseReader;
  const prompt = yield* reader
    .table("examQuestions")
    .index("by_prompt", (query) => query.eq("prompt", documentId))
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(prompt)) {
    return prompt;
  }
  const rubric = yield* reader
    .table("examQuestions")
    .index("by_rubric", (query) => query.eq("rubric", documentId))
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(rubric)) {
    return rubric;
  }
  return yield* reader
    .table("examQuestions")
    .index("by_explanation", (query) => query.eq("explanation", documentId))
    .first()
    .pipe(Effect.orDie);
});

/**
 * Refuses an edit of a document a question owns, its prompt, rubric, or explanation, when the exam
 * of that question has been scheduled, so the paper a student sat, its scoring guide, and its
 * explanation cannot change. A document that no question owns belongs to no exam, and it passes.
 */
export const requireDocumentUnfrozen = Effect.fn("exams.freeze.document")(
  function* (documentId: GenericId.GenericId<"editorDocuments">) {
    const question = yield* questionOwning(documentId);
    if (Option.isNone(question)) {
      return;
    }
    const exam = yield* (yield* DatabaseReader)
      .table("exams")
      .get(question.value.examId)
      .pipe(Effect.orDie);
    yield* requireUnfrozen(exam);
  }
);

/**
 * Freezes an exam in the transaction that schedules one of its sittings. The first schedule keeps its
 * time, and a later one leaves the exam as the first schedule froze it (ADR 0031).
 */
export const freezeExam = Effect.fn("exams.freeze.exam")(function* (
  exam: Pick<ExamsDoc, "_id" | "frozenAt">
) {
  if (exam.frozenAt !== undefined) {
    return;
  }
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("exams")
    .patch(exam._id, { frozenAt: at })
    .pipe(Effect.orDie);
});
