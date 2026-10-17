import type { GenericId } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { placeAt } from "@repo/backend/confect/exams/order";
import { Effect } from "effect";

/**
 * Moves one question of an exam to an index of its order. The order is read from the
 * exam's row in this transaction, so two moves made at once apply one after the other,
 * and each keeps every question once. Returns the order after the move.
 */
export const moveQuestion = Effect.fn("exams.question.move")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions">,
  questionId: GenericId.GenericId<"examQuestions">,
  index: number
) {
  const questions = placeAt(exam.questions, questionId, index);
  yield* (yield* DatabaseWriter)
    .table("exams")
    .patch(exam._id, { questions })
    .pipe(Effect.orDie);
  return { questions };
});
