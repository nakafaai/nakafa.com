import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type AttemptEndReason,
  getAttemptStatusFromEndReason,
} from "@repo/backend/confect/lib/attempts";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
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
import {
  type TryoutScoringStrategy,
  tryoutScoringStrategyValidator,
} from "@repo/backend/confect/tryouts/score";
import { Array as Arr, Effect, HashMap, Schema, Struct } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
type AnswerCountScoringStrategy = Exclude<TryoutScoringStrategy, "irt">;
/** Keeps every stored strategy that counts answers; IRT scores through calibrated items. */
function isAnswerCountScoringStrategy(
  strategy: TryoutScoringStrategy
): strategy is AnswerCountScoringStrategy {
  return strategy !== "irt";
}
const AnswerCountScoringStrategySchema = Schema.Literals(
  Arr.filter(
    tryoutScoringStrategyValidator.literals,
    isAnswerCountScoringStrategy
  )
);
const AnswerCountScoreSourceSchema = Schema.Struct({
  attemptId: Id("tryoutAttempts"),
  kind: Schema.Literal("answer-count"),
  scoringStrategy: AnswerCountScoringStrategySchema,
});
type AnswerCountScoreSource = typeof AnswerCountScoreSourceSchema.Type;
const IrtScoreSourceSchema = Schema.Struct({
  attemptId: Id("tryoutAttempts"),
  irt: TryoutIrtSourceSchema,
  kind: Schema.Literal("irt"),
  scoringStrategy: Schema.Literal("irt"),
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
  "setIdentity" | "tryoutSnapshotId"
>;

/** Hides persistence diagnostics from the attempt ownership boundary. */
function toAttemptReadError(cause: unknown) {
  return new TryoutRuntimeError({
    cause,
    code: "TRYOUT_RUNTIME_FAILED",
    message: "Unable to load try-out attempt.",
  });
}

/** Loads one complete source reused by terminal section and attempt scoring. */
export const loadAttemptScoreSource = Effect.fn(
  "tryouts.runtime.loadAttemptScoreSource"
)(function* (attempt: TryoutAttempt, placements: readonly TryoutPlacement[]) {
  if (attempt.scoringStrategy !== "irt") {
    return answerCountScoreSource(attempt, attempt.scoringStrategy);
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
  readonly sectionIdentity: string;
}) {
  if (args.attempt.scoringStrategy !== "irt") {
    return answerCountScoreSource(args.attempt, args.attempt.scoringStrategy);
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
  const database = yield* DatabaseReader;
  const attempt = yield* database
    .table("tryoutAttempts")
    .get(args.attemptId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toAttemptReadError),
      Effect.catchDefect((cause) => Effect.fail(toAttemptReadError(cause)))
    );
  if (!attempt || attempt.userId !== args.userId) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }
  return attempt;
});

/** Counts complete answers and correct outcomes for a section or attempt. */
export function summarizeResponses(responses: readonly TryoutResponse[]) {
  return Arr.reduce(
    responses,
    {
      answeredCount: 0,
      correctAnswers: 0,
    },
    (summary, response) => {
      if (!response.isComplete) {
        return summary;
      }
      return {
        answeredCount: summary.answeredCount + 1,
        correctAnswers:
          summary.correctAnswers +
          (readOutcome(response).status === "correct" ? 1 : 0),
      };
    }
  );
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
    const answers = readScoredAnswers(
      args.attempt.sectionSnapshots,
      args.placements,
      args.responses
    );
    if (args.source.kind === "irt") {
      return yield* scoreIrt(answers, args.source.irt, args.totalQuestions);
    }
    return yield* scoreAnswers(
      answers,
      args.source.scoringStrategy,
      args.totalQuestions
    );
  }
);

/** Finalizes one attempt and stores the score snapshot exactly once. */
export const finalizeAttemptScore = Effect.fn(
  "tryouts.runtime.finalizeAttemptScore"
)(function* (args: {
  attempt: TryoutAttempt;
  endReason: AttemptEndReason;
  now: number;
  responseIndex: TryoutResponseIndex;
  source: TryoutScoreSource;
}) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingScore = yield* database
    .table("tryoutScores")
    .get("by_tryoutAttemptId", args.attempt._id)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (existingScore) {
    return {
      scoreId: existingScore._id,
    };
  }
  if (args.attempt.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }
  const score = yield* scoreTryoutSection({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses: Arr.fromIterable(HashMap.values(args.responseIndex.responses)),
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
  const status = getAttemptStatusFromEndReason(args.endReason);
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
    setIdentity: attempt.setIdentity,
    tryoutSnapshotId: attempt.tryoutSnapshotId,
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

/** Creates one count-based score source without any database reads. */
function answerCountScoreSource(
  attempt: TryoutAttempt,
  scoringStrategy: AnswerCountScoringStrategy
): AnswerCountScoreSource {
  return {
    attemptId: attempt._id,
    kind: "answer-count",
    scoringStrategy,
  };
}

/** Creates one IRT score source already bound to its immutable attempt. */
function irtScoreSource(
  attempt: TryoutAttempt,
  irt: TryoutIrtSource
): IrtScoreSource {
  return {
    attemptId: attempt._id,
    irt,
    kind: "irt",
    scoringStrategy: "irt",
  };
}

/** Rejects a scoring source that was loaded for another attempt or strategy. */
const validateScoreSource = Effect.fn("tryouts.runtime.validateScoreSource")(
  function* (attempt: TryoutAttempt, source: TryoutScoreSource) {
    if (
      source.attemptId !== attempt._id ||
      source.scoringStrategy !== attempt.scoringStrategy
    ) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SCORE_SOURCE_MISMATCH",
        message: "Try-out score source does not match the frozen attempt.",
      });
    }
  }
);
