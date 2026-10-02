import { questionPoints } from "@nakafa/aksara-contracts/question/points";
import {
  type TryoutMarks,
  TryoutMarksSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { Outcome } from "@repo/backend/confect/response/model";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  type TryoutScoreResult,
  type TryoutScoringStrategy,
  type TryoutSectionScore,
  tryoutScoreResultValidator,
} from "@repo/backend/confect/tryouts/score";
import {
  Array as Arr,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Schema,
  Struct,
  Tuple,
} from "effect";

type SectionMarks = Pick<
  Docs["tryoutAttempts"]["sectionSnapshots"][number],
  "marks" | "sectionIdentity"
>;
type ScoredPlacement = Pick<
  Docs["tryoutAttemptPlacements"],
  "_id" | "points" | "responseSpec" | "sectionIdentity"
>;
type ScoredResponse = Pick<
  Docs["tryoutResponses"],
  "isComplete" | "isCorrect" | "outcome" | "placementId"
>;

/** Stores the complete score snapshot produced before finalizing an attempt. */
export const AttemptScore = Schema.Struct({
  ...tryoutScoreResultValidator.fields,
  scaleVersionId: Schema.optionalKey(Id("irtScaleVersions")),
});
export type AttemptScore = typeof AttemptScore.Type;

/**
 * One placed question as a score reads it: whether a complete answer exists
 * (every other question counts as blank), the signed marks of its section in a
 * penalized set, how the stored answer scored (`null` when never answered),
 * and its worth through the contract's `questionPoints`.
 */
export const ScoredAnswer = Schema.Struct({
  answered: Schema.Boolean,
  marks: Schema.optionalKey(TryoutMarksSchema),
  outcome: Schema.NullOr(Outcome),
  placementId: Id("tryoutAttemptPlacements"),
  worth: Schema.Finite,
});
export type ScoredAnswer = typeof ScoredAnswer.Type;

/**
 * Reads each placed question with its stored outcome, its worth through the
 * contract's `questionPoints`, and the frozen marks of its section.
 */
export function readScoredAnswers(
  sections: readonly SectionMarks[],
  placements: readonly ScoredPlacement[],
  responses: readonly ScoredResponse[]
): ScoredAnswer[] {
  const responsesByPlacement = HashMap.fromIterable(
    Arr.map(responses, (response) => Tuple.make(response.placementId, response))
  );
  const marksBySection = HashMap.fromIterable(
    Arr.map(sections, ({ marks, sectionIdentity }) =>
      Tuple.make(sectionIdentity, marks)
    )
  );
  return Arr.map(placements, (placement) => {
    const response = HashMap.get(responsesByPlacement, placement._id);
    const marks = Option.flatMap(
      HashMap.get(marksBySection, placement.sectionIdentity),
      Option.fromUndefinedOr
    );
    return {
      answered: Option.exists(response, ({ isComplete }) => isComplete),
      ...Option.match(marks, {
        onNone: () => ({}),
        onSome: (marks) => ({ marks }),
      }),
      outcome: Option.match(response, {
        onNone: () => null,
        onSome: readOutcome,
      }),
      placementId: placement._id,
      worth: questionPoints({
        ...Struct.pick(placement, ["points"]),
        response: placement.responseSpec,
      }),
    };
  });
}

/**
 * Scores a raw or penalized set. `rawScore` is the percentage of attainable
 * worth earned, where a correct answer earns its worth and a partial answer
 * its points; `raw` publishes it. `penalized` publishes the sum of each
 * question's section marks for a correct, wrong, or blank answer times its
 * worth. A pending answer earns nothing yet and keeps the score provisional.
 */
export const scoreAnswers = Effect.fn("tryouts.runtime.scoreAnswers")(
  function* (args: {
    answers: readonly ScoredAnswer[];
    scoringStrategy: Exclude<TryoutScoringStrategy, "irt">;
    totalQuestions: number;
  }) {
    const rawScore = getRawPercentage(args.answers);
    return {
      publishedScore:
        args.scoringStrategy === "penalized"
          ? yield* sumMarks(args.answers)
          : rawScore,
      rawScore,
      scoreStatus: getScoreStatus(args.answers, "official"),
      scoringStrategy: args.scoringStrategy,
      totalCorrect: countCorrect(args.answers),
      totalQuestions: args.totalQuestions,
    } satisfies AttemptScore;
  }
);

/** Sums signed section marks, failing closed when a section lost its marks. */
const sumMarks = Effect.fn("tryouts.runtime.sumMarks")(function* (
  answers: readonly ScoredAnswer[]
) {
  const earned = yield* Effect.forEach(answers, (answer) =>
    answer.marks === undefined
      ? Effect.fail(
          new TryoutRuntimeError({
            code: "TRYOUT_SCORE_SOURCE_MISMATCH",
            message: "Penalized try-out section is missing its signed marks.",
          })
        )
      : Effect.succeed(getMarks(answer, answer.marks))
  );
  return Num.sumAll(earned);
});

/** Returns the marks one answer earns; a pending answer earns none yet. */
function getMarks(answer: ScoredAnswer, marks: TryoutMarks) {
  if (answer.outcome === null || !answer.answered) {
    return marks.blank * answer.worth;
  }
  return Outcome.match(answer.outcome, {
    correct: () => marks.correct * answer.worth,
    incorrect: () => marks.wrong * answer.worth,
    partial: ({ points }) => marks.correct * points,
    pending: () => 0,
  });
}

/** Returns the worth one answer earned: its worth when correct, its points when partial. */
function getEarned({ outcome, worth }: ScoredAnswer) {
  if (outcome === null) {
    return 0;
  }
  return Outcome.match(outcome, {
    correct: () => worth,
    incorrect: () => 0,
    partial: ({ points }) => points,
    pending: () => 0,
  });
}

/** Returns the rounded percentage of attainable worth the answers earned. */
export function getRawPercentage(answers: readonly ScoredAnswer[]) {
  const attainable = Num.sumAll(Arr.map(answers, ({ worth }) => worth));
  const earned = Num.sumAll(Arr.map(answers, getEarned));
  return Math.round((earned / attainable) * 100);
}

/** Keeps a score provisional while any answer awaits the grader. */
export function getScoreStatus(
  answers: readonly ScoredAnswer[],
  settled: TryoutScoreResult["scoreStatus"]
) {
  return Arr.some(answers, ({ outcome }) => outcome?.status === "pending")
    ? "provisional"
    : settled;
}

/** Counts the answers that scored as correct. */
export function countCorrect(answers: readonly ScoredAnswer[]) {
  return Arr.countBy(answers, ({ outcome }) => outcome?.status === "correct");
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
