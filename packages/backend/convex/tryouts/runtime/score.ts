import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import {
  type AttemptEndReason,
  getAttemptStatusFromEndReason,
} from "@repo/backend/convex/lib/attempts";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress";
import {
  scoreIrtAttempt,
  scoreIrtSection,
} from "@repo/backend/convex/tryouts/runtime/irt";
import {
  type AttemptScore,
  scoreRawAnswers,
} from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutResponse = Doc<"tryoutResponses">;

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
export async function scoreTryoutSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    totalQuestions: number;
    tryoutSectionId: Id<"tryoutSections">;
  }
) {
  if (args.attempt.scoringStrategy === "irt") {
    const score = await scoreIrtSection(ctx, {
      ...args,
      scoringStrategy: args.attempt.scoringStrategy,
    });

    return score;
  }

  const { correctAnswers } = summarizeResponses(args.responses);

  return scoreRawAnswers({
    correctAnswers,
    scoringStrategy: args.attempt.scoringStrategy,
    totalQuestions: args.totalQuestions,
  });
}

/** Finalizes one attempt and stores the score snapshot exactly once. */
export async function finalizeAttemptScore(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    endReason: AttemptEndReason;
    now: number;
  }
) {
  const existingScore = await ctx.db
    .query("tryoutScores")
    .withIndex("by_tryoutAttemptId", (q) =>
      q.eq("tryoutAttemptId", args.attempt._id)
    )
    .unique();

  if (existingScore) {
    return { scoreId: existingScore._id };
  }

  if (args.attempt.status !== "in-progress") {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  const set = await ctx.db.get(args.attempt.tryoutSetId);

  if (!set) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Try-out set not found.",
    });
  }

  const responses = await loadAttemptResponses(ctx, args.attempt);
  const score = await scoreAttempt(ctx, {
    attempt: args.attempt,
    responses,
    scoringStrategy: args.attempt.scoringStrategy,
  });
  const scoreId = await insertAttemptScore(ctx, {
    attempt: args.attempt,
    finalizedAt: args.now,
    score,
  });
  const status = getAttemptStatusFromEndReason(args.endReason);

  await ctx.db.patch(args.attempt._id, {
    completedAt: args.now,
    endReason: args.endReason,
    lastActivityAt: args.now,
    scoreStatus: score.scoreStatus,
    status,
    totalCorrect: score.totalCorrect,
  });

  await writeTryoutSetProgress(ctx, {
    attempt: args.attempt,
    publishedScore: score.publishedScore,
    set,
    status,
    updatedAt: args.now,
  });

  await captureProductEvent(ctx, {
    distinctId: args.attempt.userId,
    event: {
      name: "tryout attempt completed",
      properties: {
        attempt_number: args.attempt.attemptNumber,
        country_key: set.countryKey,
        exam_key: set.examKey,
        locale: set.locale,
        raw_score_percentage: score.rawScore,
        score_status: score.scoreStatus,
        set_key: set.setKey,
        theta: score.theta,
        total_correct: score.totalCorrect,
        total_questions: score.totalQuestions,
        track_key: set.trackKey,
      },
    },
    timestamp: new Date(args.now),
  });

  return { scoreId };
}

/** Loads bounded responses for one complete try-out attempt. */
async function loadAttemptResponses(ctx: MutationCtx, attempt: TryoutAttempt) {
  const responses = await ctx.db
    .query("tryoutResponses")
    .withIndex("by_tryoutAttemptId_and_questionId", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.totalQuestions + 1);

  if (responses.length > attempt.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      message: "Try-out response count exceeds the attempt question count.",
    });
  }

  return responses;
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
    tryoutSetId: args.attempt.tryoutSetId,
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
