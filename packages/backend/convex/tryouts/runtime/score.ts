import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type AttemptEndReason,
  getAttemptStatusFromEndReason,
} from "@repo/backend/convex/lib/attempts";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import {
  scoreIrtAttempt,
  scoreIrtSection,
} from "@repo/backend/convex/tryouts/runtime/irt";
import {
  loadAttemptIrtSource,
  loadSectionIrtSource,
  type TryoutIrtSource,
} from "@repo/backend/convex/tryouts/runtime/irt/items";
import type { TryoutResponseIndex } from "@repo/backend/convex/tryouts/runtime/response";
import {
  type AttemptScore,
  scoreRawAnswers,
} from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;
type AnswerCountScoringStrategy = Exclude<TryoutScoringStrategy, "irt">;

interface AnswerCountScoreSource {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly kind: "answer-count";
  readonly scoringStrategy: AnswerCountScoringStrategy;
}

interface IrtScoreSource {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly irt: TryoutIrtSource;
  readonly kind: "irt";
  readonly scoringStrategy: "irt";
}

export type TryoutScoreSource = AnswerCountScoreSource | IrtScoreSource;

interface AttemptScoreOwner {
  readonly setIdentity: string;
  readonly tryoutSnapshotId: string;
}

/** Loads one complete source reused by terminal section and attempt scoring. */
export const loadAttemptScoreSource = Effect.fn(
  "tryouts.runtime.loadAttemptScoreSource"
)(function* (
  ctx: MutationCtx,
  attempt: TryoutAttempt,
  placements: TryoutPlacement[]
) {
  if (attempt.scoringStrategy !== "irt") {
    return answerCountScoreSource(attempt, attempt.scoringStrategy);
  }

  const irt = yield* loadAttemptIrtSource(ctx, attempt, placements);
  return irtScoreSource(attempt, irt);
});

/** Loads one bounded section source for a non-terminal section score. */
export const loadSectionScoreSource = Effect.fn(
  "tryouts.runtime.loadSectionScoreSource"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly placements: TryoutPlacement[];
    readonly sectionIdentity: string;
  }
) {
  if (args.attempt.scoringStrategy !== "irt") {
    return answerCountScoreSource(args.attempt, args.attempt.scoringStrategy);
  }

  const irt = yield* loadSectionIrtSource(ctx, args);
  return irtScoreSource(args.attempt, irt);
});

/** Loads one owned attempt or rejects it before mutating runtime rows. */
export const requireOwnedAttempt = Effect.fn(
  "tryouts.runtime.requireOwnedAttempt"
)(function* (
  ctx: MutationCtx,
  args: { attemptId: Id<"tryoutAttempts">; userId: Id<"users"> }
) {
  const attempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attemptId)
  ).pipe(
    Effect.mapError(
      (cause) =>
        new TryoutRuntimeError({
          cause,
          code: "TRYOUT_RUNTIME_FAILED",
          message: "Unable to load try-out attempt.",
        })
    )
  );

  if (!attempt || attempt.userId !== args.userId) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return attempt;
});

/** Counts response answers and correctness for a section or attempt. */
export function summarizeResponses(responses: TryoutResponse[]) {
  return responses.reduce(
    (summary, response) => {
      if (!response.isComplete) {
        return summary;
      }
      return {
        answeredCount: summary.answeredCount + 1,
        correctAnswers: summary.correctAnswers + (response.isCorrect ? 1 : 0),
      };
    },
    { answeredCount: 0, correctAnswers: 0 }
  );
}

/** Scores one terminal section with its parent attempt's frozen strategy. */
export const scoreTryoutSection = Effect.fn("tryouts.runtime.scoreSection")(
  function* (args: {
    attempt: TryoutAttempt;
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    source: TryoutScoreSource;
    totalQuestions: number;
  }) {
    yield* validateScoreSource(args.attempt, args.source);
    if (args.source.kind === "irt") {
      return yield* scoreIrtSection({
        placements: args.placements,
        responses: args.responses,
        scoringStrategy: args.source.scoringStrategy,
        source: args.source.irt,
        totalQuestions: args.totalQuestions,
      });
    }

    const { correctAnswers } = summarizeResponses(args.responses);

    return scoreRawAnswers({
      correctAnswers,
      scoringStrategy: args.source.scoringStrategy,
      totalQuestions: args.totalQuestions,
    });
  }
);

/** Finalizes one attempt and stores the score snapshot exactly once. */
export const finalizeAttemptScore = Effect.fn(
  "tryouts.runtime.finalizeAttemptScore"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    endReason: AttemptEndReason;
    now: number;
    responseIndex: TryoutResponseIndex;
    source: TryoutScoreSource;
  }
) {
  const existingScore = yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutScores")
      .withIndex("by_tryoutAttemptId", (q) =>
        q.eq("tryoutAttemptId", args.attempt._id)
      )
      .unique()
  );

  if (existingScore) {
    return { scoreId: existingScore._id };
  }

  if (args.attempt.status !== "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  const responses = [...args.responseIndex.responses.values()];
  const score = yield* scoreAttempt({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses,
    source: args.source,
  });
  const owner = readAttemptScoreOwner(args.attempt);
  const scoreId = yield* tryRuntimePromise(() =>
    insertAttemptScore(ctx, {
      attempt: args.attempt,
      finalizedAt: args.now,
      owner,
      score,
    })
  );
  const status = getAttemptStatusFromEndReason(args.endReason);

  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.attempt._id, {
      completedAt: args.now,
      endReason: args.endReason,
      lastActivityAt: args.now,
      scoreStatus: score.scoreStatus,
      status,
      totalCorrect: score.totalCorrect,
    })
  );

  yield* writeTryoutSetProgress(ctx, {
    attempt: args.attempt,
    publishedScore: score.publishedScore,
    status,
    updatedAt: args.now,
  }).pipe(
    Effect.mapError(
      (error) =>
        new TryoutRuntimeError({
          code: error.code,
          message: error.message,
        })
    )
  );

  return { scoreId };
});

/** Reads score ownership from the immutable signed attempt. */
function readAttemptScoreOwner(attempt: TryoutAttempt): AttemptScoreOwner {
  return {
    setIdentity: attempt.setIdentity,
    tryoutSnapshotId: attempt.tryoutSnapshotId,
  };
}

/** Scores one attempt with the scoring strategy declared by its set. */
const scoreAttempt = Effect.fn("tryouts.runtime.scoreAttempt")(
  function* (args: {
    attempt: TryoutAttempt;
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    source: TryoutScoreSource;
  }) {
    yield* validateScoreSource(args.attempt, args.source);
    if (args.source.kind === "irt") {
      return yield* scoreIrtAttempt({
        ...args,
        scoringStrategy: args.source.scoringStrategy,
        source: args.source.irt,
      });
    }

    return scoreRawAttempt({
      attempt: args.attempt,
      responses: args.responses,
      scoringStrategy: args.source.scoringStrategy,
    });
  }
);

/** Scores raw and weighted sets from correctness snapshots. */
function scoreRawAttempt(args: {
  attempt: TryoutAttempt;
  responses: TryoutResponse[];
  scoringStrategy: TryoutScoringStrategy;
}): AttemptScore {
  const { correctAnswers } = summarizeResponses(args.responses);

  return scoreRawAnswers({
    correctAnswers,
    scoringStrategy: args.scoringStrategy,
    totalQuestions: args.attempt.totalQuestions,
  });
}

/** Inserts the public score snapshot without undefined optional fields. */
function insertAttemptScore(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    finalizedAt: number;
    owner: AttemptScoreOwner;
    score: AttemptScore;
  }
) {
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

  if (args.score.scaleVersionId) {
    const scoreWithScale = {
      ...score,
      scaleVersionId: args.score.scaleVersionId,
    };

    if (args.score.theta !== undefined) {
      return ctx.db.insert("tryoutScores", {
        ...scoreWithScale,
        theta: args.score.theta,
        thetaSE: args.score.thetaSE,
      });
    }

    return ctx.db.insert("tryoutScores", scoreWithScale);
  }

  return ctx.db.insert("tryoutScores", score);
}

/** Creates one count-based score source without any database reads. */
function answerCountScoreSource(
  attempt: TryoutAttempt,
  scoringStrategy: AnswerCountScoringStrategy
): AnswerCountScoreSource {
  return { attemptId: attempt._id, kind: "answer-count", scoringStrategy };
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
