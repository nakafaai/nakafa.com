import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { QuestionPoints } from "@repo/backend/confect/exams/question";
import { Clock, Effect } from "effect";

/**
 * Sets the points of one question of an exam, its weight in the exam. Points do not change the
 * answers, the key, or the revision, which counts the answer and key edits only, so an answer
 * edit that is in flight stays current.
 */
export const setPoints = Effect.fn("exams.question.points")(function* (
  question: Pick<ExamQuestionsDoc, "_id">,
  points: typeof QuestionPoints.Type
) {
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, { points, updatedAt: at })
    .pipe(Effect.orDie);
});
