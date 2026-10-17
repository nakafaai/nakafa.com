import type { GenericId } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { questionView } from "@repo/backend/confect/exams/question";
import { Array as Arr, Effect } from "effect";

/** The IDs of the questions an exam holds, in their order. */
type QuestionIds = Pick<ExamsDoc, "questions">;

/**
 * Reads a question of the exam, by its ID. A question the exam does not hold is
 * refused as a missing object, so a question of another exam reveals nothing.
 */
export const questionOf = Effect.fn("exams.question.of")(function* (
  exam: QuestionIds,
  questionId: GenericId.GenericId<"examQuestions">
) {
  if (!Arr.contains(exam.questions, questionId)) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
  return yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
});

/** Reads one question as its wire view, with its answers and key decoded. */
export const readQuestion = Effect.fn("exams.question.read")(function* (
  questionId: GenericId.GenericId<"examQuestions">
) {
  const row = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  return yield* questionView(row);
});
