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
import { loadAttemptResponses } from "@repo/backend/convex/tryouts/runtime/response";
import {
  type AttemptScore,
  scoreRawAnswers,
} from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/score";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutResponse = Doc<"tryoutResponses">;

interface AttemptScoreOwner {
  readonly setIdentity: string;
  readonly tryoutSnapshotId: string;
}

/** Loads one owned attempt or rejects it before mutating runtime rows. */
export async function requireOwnedAttempt(
  ctx: MutationCtx,
  args: { attemptId: Id<"tryoutAttempts">; userId: Id<"users"> }
) {
  const attempt = await ctx.db.get(args.attemptId);

  if (!attempt || attempt.userId !== args.userId) {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return attempt;
}

/** Counts response answers and correctness for a section or attempt. */
export function summarizeResponses(responses: TryoutResponse[]) {
  return responses.reduce(
    (summary, response) => ({
      answeredCount: summary.answeredCount + 1,
      correctAnswers: summary.correctAnswers + (response.isCorrect ? 1 : 0),
    }),
    { answeredCount: 0, correctAnswers: 0 }
  );
}

/** Scores one terminal section with its parent attempt's frozen strategy. */
export const scoreTryoutSection = Effect.fn("tryouts.runtime.scoreSection")(
  function* (
    ctx: MutationCtx,
    args: {
      attempt: TryoutAttempt;
      responses: TryoutResponse[];
      sectionKey: string;
      totalQuestions: number;
    }
  ) {
    if (args.attempt.scoringStrategy === "irt") {
      return yield* tryRuntimePromise(() =>
        scoreIrtSection(ctx, {
          ...args,
          scoringStrategy: args.attempt.scoringStrategy,
        })
      );
    }

    const { correctAnswers } = summarizeResponses(args.responses);

    return scoreRawAnswers({
      correctAnswers,
      scoringStrategy: args.attempt.scoringStrategy,
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

  const responses = yield* loadAttemptResponses(ctx, args.attempt);
  const score = yield* tryRuntimePromise(() =>
    Promise.resolve(
      scoreAttempt(ctx, {
        attempt: args.attempt,
        responses,
        scoringStrategy: args.attempt.scoringStrategy,
      })
    )
  );
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
function scoreAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
  }
) {
  if (args.scoringStrategy === "irt") {
    return scoreIrtAttempt(ctx, args);
  }

  return scoreRawAttempt(args);
}

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
