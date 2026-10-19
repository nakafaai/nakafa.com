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
 * Refuses an edit of the prompt of a question whose exam a sitting has scheduled, so the paper a
 * student sat cannot change. A document that is no question's prompt belongs to no exam, and it passes.
 */
export const requirePromptUnfrozen = Effect.fn("exams.freeze.prompt")(
  function* (documentId: GenericId.GenericId<"editorDocuments">) {
    const reader = yield* DatabaseReader;
    const question = yield* reader
      .table("examQuestions")
      .index("by_prompt", (query) => query.eq("prompt", documentId))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(question)) {
      return;
    }
    const exam = yield* reader
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
