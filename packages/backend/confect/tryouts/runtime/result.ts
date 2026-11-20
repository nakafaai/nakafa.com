import type { ScoringStrategy } from "@nakafa/aksara-contracts/assessment/scoring";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  answersQuestion,
  earnedPoints,
  QuestionGrade,
} from "@repo/backend/confect/assessment/parts";
import { NO_RESPONSE } from "@repo/backend/confect/assessment/response";
import {
  gradeQuestion,
  isCorrectGrade,
} from "@repo/backend/confect/tryouts/response/answer";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type {
  TryoutScoreResult,
  TryoutSectionScore,
} from "@repo/backend/confect/tryouts/score";
import { tryoutScoreResultValidator } from "@repo/backend/confect/tryouts/score";
import {
  Array as Arr,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Schema,
  Tuple,
} from "effect";

type ScoredPlacement = Pick<
  Docs["tryoutAttemptPlacements"],
  "_id" | "interactionJson" | "keyJson" | "laterInteractions" | "rule"
>;
type ScoredResponse = Pick<
  Docs["tryoutResponses"],
  "grade" | "placementId" | "response"
>;

/** Stores the complete score snapshot produced before finalizing an attempt. */
export const AttemptScore = Schema.Struct({
  ...tryoutScoreResultValidator.fields,
  scaleVersionId: Schema.optionalKey(Id("irtScaleVersions")),
});
export type AttemptScore = typeof AttemptScore.Type;

/**
 * One placed question as a score reads it: whether the learner answered it, and how its frozen rules
 * grade the stored answer, or the empty answer of a question never answered, whose ceiling is still
 * the question's worth.
 */
export const ScoredAnswer = Schema.Struct({
  answered: Schema.Boolean,
  grade: QuestionGrade,
  placementId: Id("tryoutAttemptPlacements"),
});
export type ScoredAnswer = typeof ScoredAnswer.Type;

/** Reads each placed question with its stored grade, grading the empty answer of a question never answered. */
export const readScoredAnswers = Effect.fn("tryouts.runtime.readScoredAnswers")(
  function* (
    placements: readonly ScoredPlacement[],
    responses: readonly ScoredResponse[]
  ) {
    const responsesByPlacement = HashMap.fromIterable(
      Arr.map(responses, (response) =>
        Tuple.make(response.placementId, response)
      )
    );
    return yield* Effect.forEach(placements, (placement) =>
      Option.match(HashMap.get(responsesByPlacement, placement._id), {
        onNone: () =>
          Effect.map(readPlacedQuestion(placement), (question) => ({
            answered: false,
            grade: gradeQuestion(question, NO_RESPONSE),
            placementId: placement._id,
          })),
        onSome: (response) =>
          Effect.succeed({
            answered: answersQuestion(response.response),
            grade: response.grade,
            placementId: placement._id,
          }),
      })
    );
  }
);

/**
 * Scores a raw or penalized attempt by its frozen strategy. `rawScore` is the percentage of the
 * attainable points earned, the sum of the points each question earned over the sum of its ceiling; `raw`
 * publishes it. `penalized` publishes the marks of each question: its correct marks for every point
 * it earned, its wrong marks for an answered question that earned none, and its blank marks for an
 * unanswered one. A grade that waits for a grader keeps the score provisional: its question earns only
 * what its scored parts earned, and a penalized one earns no marks yet.
 * A composite strategy scores sections by a formula no profile uses yet, so it is refused.
 */
export const scoreAnswers = Effect.fn("tryouts.runtime.scoreAnswers")(
  function* (
    answers: readonly ScoredAnswer[],
    scoring: Exclude<ScoringStrategy, { readonly kind: "irt" }>,
    totalQuestions: number
  ) {
    if (scoring.kind === "composite") {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SCORE_STRATEGY_UNSUPPORTED",
        message: "Try-out composite scoring has no formula in the engine.",
      });
    }
    const rawScore = getRawPercentage(answers);
    return {
      publishedScore:
        scoring.kind === "penalized"
          ? Num.sumAll(
              Arr.map(answers, (answer) => marksOf(answer, scoring.marks))
            )
          : rawScore,
      rawScore,
      scoreStatus: getScoreStatus(answers, "official"),
      scoringStrategy: scoring.kind,
      totalCorrect: countCorrect(answers),
      totalQuestions,
    } satisfies AttemptScore;
  }
);

/** Returns the marks one answer earns under a penalized strategy; a grade that waits for a person earns none yet. */
function marksOf(
  answer: ScoredAnswer,
  marks: Extract<ScoringStrategy, { readonly kind: "penalized" }>["marks"]
) {
  const { grade: graded } = answer;
  if (graded.status === "pending") {
    return 0;
  }
  if (!answer.answered) {
    return marks.blank * graded.ceiling;
  }
  return graded.category === 0
    ? marks.wrong * graded.ceiling
    : marks.correct * graded.category;
}

/**
 * Returns the rounded percentage of the attainable points the answers earned, a question of several parts
 * counting what its scored parts earned while another part waits for a grader (`earnedPoints`).
 */
export function getRawPercentage(answers: readonly ScoredAnswer[]) {
  const attainable = Num.sumAll(
    Arr.map(answers, ({ grade: graded }) => graded.ceiling)
  );
  const earned = Num.sumAll(
    Arr.map(answers, ({ grade: graded }) => earnedPoints(graded))
  );
  return attainable === 0 ? 0 : Math.round((earned / attainable) * 100);
}

/** Keeps a score provisional while any answer waits for a person. */
export function getScoreStatus(
  answers: readonly ScoredAnswer[],
  settled: TryoutScoreResult["scoreStatus"]
) {
  return Arr.some(answers, ({ grade: graded }) => graded.status === "pending")
    ? "provisional"
    : settled;
}

/** Counts the answers that earned every point of their question. */
export function countCorrect(answers: readonly ScoredAnswer[]) {
  return Arr.countBy(answers, ({ grade: graded }) => isCorrectGrade(graded));
}

/** Stores the immutable section-owned subset of one calculated score. */
export const getSectionScoreSnapshot = Effect.fn(
  "tryouts.runtime.getSectionScoreSnapshot"
)(function* (score: AttemptScore) {
  const snapshot: TryoutSectionScore = {
    publishedScore: score.publishedScore,
    rawScore: score.rawScore,
    scoreStatus: score.scoreStatus,
    scoringStrategy: score.scoringStrategy,
  };
  if (score.theta === undefined && score.thetaSE === undefined) {
    return snapshot;
  }
  if (score.theta === undefined || score.thetaSE === undefined) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      message: "Try-out score estimate is missing theta or standard error.",
    });
  }
  return {
    ...snapshot,
    theta: score.theta,
    thetaSE: score.thetaSE,
  };
});
