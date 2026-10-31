import { ScoringStrategySchema } from "@nakafa/aksara-contracts/assessment/scoring";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type EndReason,
  statusOf,
} from "@repo/backend/confect/assessment/gate/end";
import { isAnswered } from "@repo/backend/confect/assessment/response";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { isCorrectGrade } from "@repo/backend/confect/tryouts/response/answer";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { scoreIrt } from "@repo/backend/confect/tryouts/runtime/irt";
import {
  loadAttemptIrtSource,
  loadSectionIrtSource,
  type TryoutIrtSource,
  TryoutIrtSourceSchema,
} from "@repo/backend/confect/tryouts/runtime/irt/items";
import type { TryoutResponseIndex } from "@repo/backend/confect/tryouts/runtime/response";
import {
  type AttemptScore,
  readScoredAnswers,
  scoreAnswers,
} from "@repo/backend/confect/tryouts/runtime/result";
import { Array as Arr, Effect, Schema, Struct } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
/** The profile's strategies by kind. */
const Strategies = ScoringStrategySchema.pipe(Schema.toTaggedUnion("kind"));

/** Every strategy that scores from the answers themselves; IRT scores through calibrated items. */
const AnswerCountScoringSchema = Schema.Union([
  Strategies.cases.raw,
  Strategies.cases.penalized,
  Strategies.cases.composite,
]);
const AnswerCountScoreSourceSchema = Schema.Struct({
  attemptId: Id("tryoutAttempts"),
  kind: Schema.Literal("answer-count"),
  scoring: AnswerCountScoringSchema,
});
type AnswerCountScoreSource = typeof AnswerCountScoreSourceSchema.Type;
const IrtScoreSourceSchema = Schema.Struct({
  attemptId: Id("tryoutAttempts"),
  irt: TryoutIrtSourceSchema,
  kind: Schema.Literal("irt"),
});
type IrtScoreSource = typeof IrtScoreSourceSchema.Type;
const TryoutScoreSourceSchema = Schema.Union([
  AnswerCountScoreSourceSchema,
  IrtScoreSourceSchema,
]);
export type TryoutScoreSource = typeof TryoutScoreSourceSchema.Type;
/** Score ownership fields copied from the immutable attempt. */
type AttemptScoreOwner = Pick<
  TryoutAttempt,
  "assessmentSnapshotId" | "setIdentity"
>;

/** Loads one complete source reused by terminal section and attempt scoring. */
export const loadAttemptScoreSource = Effect.fn(
  "tryouts.runtime.loadAttemptScoreSource"
)(function* (attempt: TryoutAttempt, placements: readonly TryoutPlacement[]) {
  if (attempt.scoring.kind !== "irt") {
    return answerCountScoreSource(attempt, attempt.scoring);
  }
  const irt = yield* loadAttemptIrtSource(attempt, placements);
  return irtScoreSource(attempt, irt);
});

/** Loads one bounded section source for a non-terminal section score. */
export const loadSectionScoreSource = Effect.fn(
  "tryouts.runtime.loadSectionScoreSource"
)(function* (args: {
  readonly attempt: TryoutAttempt;
  readonly placements: readonly TryoutPlacement[];
  readonly sectionKey: string;
}) {
  if (args.attempt.scoring.kind !== "irt") {
    return answerCountScoreSource(args.attempt, args.attempt.scoring);
  }
  const irt = yield* loadSectionIrtSource(args);
  return irtScoreSource(args.attempt, irt);
});

/** Loads one owned attempt or rejects it before mutating runtime rows. */
export const requireOwnedAttempt = Effect.fn(
  "tryouts.runtime.requireOwnedAttempt"
)(function* (args: {
  attemptId: TryoutAttempt["_id"];
  userId: TryoutAttempt["userId"];
}) {
  const attempt = yield* (yield* DatabaseReader)
    .table("tryoutAttempts")
    .get(args.attemptId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () => Effect.succeed(null),
      })
    );
  if (!attempt || attempt.userId !== args.userId) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }
  return attempt;
});

/** Counts answered questions and correct grades for a section or attempt. */
export function summarizeResponses(responses: readonly TryoutResponse[]) {
  return {
    answeredCount: Arr.countBy(responses, ({ response }) =>
      isAnswered(response)
    ),
    correctAnswers: Arr.countBy(responses, ({ grade }) =>
      isCorrectGrade(grade)
    ),
  };
}

/** Scores the placements of one section or attempt with its frozen strategy. */
export const scoreTryoutSection = Effect.fn("tryouts.runtime.scoreSection")(
  function* (args: {
    attempt: TryoutAttempt;
    placements: readonly TryoutPlacement[];
    responses: readonly TryoutResponse[];
    source: TryoutScoreSource;
    totalQuestions: number;
  }) {
    yield* validateScoreSource(args.attempt, args.source);
    const answers = yield* readScoredAnswers(args.placements, args.responses);
    if (args.source.kind === "irt") {
      return yield* scoreIrt(answers, args.source.irt, args.totalQuestions);
    }
    return yield* scoreAnswers(
      answers,
      args.source.scoring,
      args.totalQuestions
    );
  }
);

/** Finalizes one active attempt and stores its score snapshot. */
export const finalizeAttemptScore = Effect.fn(
  "tryouts.runtime.finalizeAttemptScore"
)(function* (args: {
  attempt: TryoutAttempt;
  endReason: EndReason;
  now: number;
  responseIndex: TryoutResponseIndex;
  source: TryoutScoreSource;
}) {
  const writer = yield* DatabaseWriter;
  // The score and the attempt's terminal status are written together, so an active attempt has no score.
  if (args.attempt.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }
  const score = yield* scoreTryoutSection({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses: args.responseIndex.responses,
    source: args.source,
    totalQuestions: args.attempt.totalQuestions,
  });
  const owner = readAttemptScoreOwner(args.attempt);
  const scoreId = yield* writer
    .table("tryoutScores")
    .insert(
      attemptScoreValues({
        attempt: args.attempt,
        finalizedAt: args.now,
        owner,
        score,
      })
    )
    .pipe(Effect.mapError(toTryoutRuntimeError));
  const status = statusOf(args.endReason);
  yield* writer
    .table("tryoutAttempts")
    .patch(args.attempt._id, {
      completedAt: args.now,
      endReason: args.endReason,
      lastActivityAt: args.now,
      scoreStatus: score.scoreStatus,
      status,
      totalCorrect: score.totalCorrect,
    })
    .pipe(Effect.mapError(toTryoutRuntimeError));
  yield* writeTryoutSetProgress({
    attempt: args.attempt,
    publishedScore: score.publishedScore,
    status,
    updatedAt: args.now,
  });
  return {
    scoreId,
  };
});

/** Reads score ownership from the immutable signed attempt. */
function readAttemptScoreOwner(attempt: TryoutAttempt): AttemptScoreOwner {
  return {
    assessmentSnapshotId: attempt.assessmentSnapshotId,
    setIdentity: attempt.setIdentity,
  };
}

/** Persists one public score; Convex omits undefined optional fields. */
function attemptScoreValues(args: {
  attempt: TryoutAttempt;
  finalizedAt: number;
  owner: AttemptScoreOwner;
  score: AttemptScore;
}) {
  const score = {
    finalizedAt: args.finalizedAt,
    publishedScore: args.score.publishedScore,
    rawScore: args.score.rawScore,
    scoreStatus: args.score.scoreStatus,
    scoringStrategy: args.score.scoringStrategy,
    totalCorrect: args.score.totalCorrect,
    totalQuestions: args.score.totalQuestions,
    tryoutAttemptId: args.attempt._id,
    ...args.owner,
    userId: args.attempt.userId,
  };
  return {
    ...score,
    ...Struct.pick(args.score, ["scaleVersionId"]),
    ...Struct.pick(args.score, ["theta"]),
    ...Struct.pick(args.score, ["thetaSE"]),
  };
}

/** Creates one count-based score source from the attempt's frozen strategy, without any database reads. */
function answerCountScoreSource(
  attempt: TryoutAttempt,
  scoring: AnswerCountScoreSource["scoring"]
): AnswerCountScoreSource {
  return { attemptId: attempt._id, kind: "answer-count", scoring };
}

/** Creates one IRT score source already bound to its immutable attempt. */
function irtScoreSource(
  attempt: TryoutAttempt,
  irt: TryoutIrtSource
): IrtScoreSource {
  return { attemptId: attempt._id, irt, kind: "irt" };
}

/** Rejects a scoring source that was loaded for another attempt or strategy. */
const validateScoreSource = Effect.fn("tryouts.runtime.validateScoreSource")(
  function* (attempt: TryoutAttempt, source: TryoutScoreSource) {
    const kind = source.kind === "irt" ? "irt" : source.scoring.kind;
    if (source.attemptId !== attempt._id || kind !== attempt.scoring.kind) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SCORE_SOURCE_MISMATCH",
        message: "Try-out score source does not match the frozen attempt.",
      });
    }
  }
);
