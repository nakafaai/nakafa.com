import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { ExamFrozen } from "@repo/backend/confect/exams/errors";
import { Clock, Effect } from "effect";

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
