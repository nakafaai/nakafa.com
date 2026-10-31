import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { ScoringDoesNotFit } from "@repo/backend/confect/exams/errors";
import type { QuestionPoints } from "@repo/backend/confect/exams/question";
import {
  type ScoringKind,
  scoringPoints,
  scoringRule,
  takesScoring,
} from "@repo/backend/confect/exams/scoring";
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

/**
 * Gives one question the rule that shares its points among the parts of an answer. A rule of several steps
 * raises points too few to hold them (`scoringPoints`). A template whose answer has no parts to share them
 * among is refused as `ScoringDoesNotFit`, which writes nothing. Like the points, a rule leaves the revision.
 */
export const setScoring = Effect.fn("exams.question.scoring")(function* (
  question: Pick<ExamQuestionsDoc, "_id" | "points" | "template">,
  kind: ScoringKind
) {
  if (!takesScoring(question.template)) {
    return yield* new ScoringDoesNotFit();
  }
  const scoring = scoringRule(kind);
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, {
      points: scoringPoints(question.points, scoring),
      scoring,
      updatedAt: at,
    })
    .pipe(Effect.orDie);
});
