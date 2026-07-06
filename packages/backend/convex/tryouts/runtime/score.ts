import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import type {
  TryoutScoreStatus,
  TryoutScoringStrategy,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

const MAX_THETA = 4;
const MIN_THETA = -4;
const THETA_ITERATIONS = 25;
const THETA_STEP_LIMIT = 1;
const THETA_TOLERANCE = 0.001;
const MIN_INFORMATION = 0.000_001;
const IRT_SCORE_MEAN = 500;
const IRT_SCORE_STANDARD_DEVIATION = 100;

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

interface AttemptScore {
  publishedScore: number;
  rawScore: number;
  scaleVersionId?: Id<"irtScaleVersions">;
  scoreStatus: TryoutScoreStatus;
  scoringStrategy: TryoutScoringStrategy;
  theta?: number;
  thetaSE?: number;
  totalCorrect: number;
  totalQuestions: number;
}

interface IrtItemResponse {
  isCorrect: boolean;
  item: Doc<"irtScaleItems">;
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

/** Finalizes one attempt and stores the score snapshot exactly once. */
export async function finalizeAttemptScore(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number }
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
    scoringStrategy: set.scoringStrategy,
  });
  const scoreId = await insertAttemptScore(ctx, {
    attempt: args.attempt,
    finalizedAt: args.now,
    score,
  });
  const status = getAttemptStatus(args.attempt, args.now);
  const endReason = getEndReason(args.attempt, args.now);

  await ctx.db.patch(args.attempt._id, {
    completedAt: args.now,
    endReason,
    lastActivityAt: args.now,
    scoreStatus: score.scoreStatus,
    status,
    totalCorrect: score.totalCorrect,
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
  const publishedScore = getRawPercentage(
    correctAnswers,
    args.attempt.totalQuestions
  );

  return {
    publishedScore,
    rawScore: publishedScore,
    scoreStatus: "official",
    scoringStrategy: args.scoringStrategy,
    totalCorrect: correctAnswers,
    totalQuestions: args.attempt.totalQuestions,
  };
}

/** Scores an IRT set from the latest published item scale. */
async function scoreIrtAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
  }
): Promise<AttemptScore> {
  const scale = await loadLatestScaleVersion(ctx, args.attempt);
  const placements = await loadAttemptPlacements(ctx, args.attempt);
  const itemResponses = await loadIrtItemResponses(ctx, {
    placements,
    responses: args.responses,
    scaleVersionId: scale._id,
  });
  const estimate = estimateTheta(itemResponses);
  const { correctAnswers } = summarizeResponses(args.responses);
  const publishedScore = getPublishedIrtScore(estimate.theta);

  return {
    publishedScore,
    rawScore: getRawPercentage(correctAnswers, args.attempt.totalQuestions),
    scaleVersionId: scale._id,
    scoreStatus: scale.status,
    scoringStrategy: args.scoringStrategy,
    theta: estimate.theta,
    thetaSE: estimate.thetaSE,
    totalCorrect: correctAnswers,
    totalQuestions: args.attempt.totalQuestions,
  };
}

/** Loads the latest IRT scale for one set before publishing an IRT score. */
async function loadLatestScaleVersion(
  ctx: MutationCtx,
  attempt: TryoutAttempt
) {
  const scale = await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
      q.eq("tryoutSetId", attempt.tryoutSetId)
    )
    .order("desc")
    .first();

  if (scale) {
    return scale;
  }

  throw new ConvexError({
    code: "TRYOUT_IRT_SCALE_REQUIRED",
    message: "Published IRT scale is required before scoring this try-out.",
  });
}

/** Loads the placement snapshot used by scoring and runtime rendering. */
async function loadAttemptPlacements(ctx: MutationCtx, attempt: TryoutAttempt) {
  const placements = await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.totalQuestions + 1);

  if (placements.length > attempt.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_COUNT_EXCEEDED",
      message: "Try-out placement count exceeds the attempt question count.",
    });
  }

  return placements;
}

/** Loads and validates all item parameters for a completed IRT attempt. */
function loadIrtItemResponses(
  ctx: MutationCtx,
  args: {
    placements: TryoutPlacement[];
    responses: TryoutResponse[];
    scaleVersionId: Id<"irtScaleVersions">;
  }
) {
  const responsesByPlacement = new Map(
    args.responses.map((response) => [response.placementId, response])
  );

  return Promise.all(
    args.placements.map(async (placement) => {
      const item = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
          q
            .eq("scaleVersionId", args.scaleVersionId)
            .eq("questionSourceKey", placement.questionSourceKey)
        )
        .unique();

      if (!item) {
        throw new ConvexError({
          code: "TRYOUT_IRT_ITEM_NOT_FOUND",
          message: "IRT scale item is missing for one try-out question.",
        });
      }

      if (!matchesPlacementSnapshot(item, placement)) {
        throw new ConvexError({
          code: "TRYOUT_IRT_ITEM_STALE",
          message: "IRT scale item is stale for one try-out question.",
        });
      }

      const response = responsesByPlacement.get(placement._id);

      return {
        isCorrect: Boolean(response?.isCorrect),
        item,
      };
    })
  );
}

/** Verifies that an IRT item belongs to the exact placed source snapshot. */
function matchesPlacementSnapshot(
  item: Doc<"irtScaleItems">,
  placement: TryoutPlacement
) {
  return (
    item.contentHash === placement.contentHash &&
    item.questionId === placement.questionId &&
    item.sourceRevision === placement.sourceRevision
  );
}

/** Estimates theta with bounded Newton-Raphson steps for a 2PL item scale. */
function estimateTheta(itemResponses: IrtItemResponse[]) {
  let theta = 0;

  for (let index = 0; index < THETA_ITERATIONS; index++) {
    const step = getThetaStep(itemResponses, theta);

    if (Math.abs(step) < THETA_TOLERANCE) {
      break;
    }

    theta = clamp(theta + step, MIN_THETA, MAX_THETA);
  }

  const information = getInformation(itemResponses, theta);

  if (information < MIN_INFORMATION) {
    throw new ConvexError({
      code: "TRYOUT_IRT_INFORMATION_TOO_LOW",
      message: "IRT scale information is too low for scoring this attempt.",
    });
  }

  return {
    theta,
    thetaSE: 1 / Math.sqrt(information),
  };
}

/** Computes one bounded Newton step for the current theta. */
function getThetaStep(itemResponses: IrtItemResponse[], theta: number) {
  let score = 0;
  let information = 0;

  for (const itemResponse of itemResponses) {
    const discrimination = getDiscrimination(itemResponse.item);
    const expected = getExpectedProbability(itemResponse.item, theta);
    const observed = itemResponse.isCorrect ? 1 : 0;

    score += discrimination * (observed - expected);
    information += discrimination * discrimination * expected * (1 - expected);
  }

  if (information < MIN_INFORMATION) {
    return 0;
  }

  return clamp(score / information, -THETA_STEP_LIMIT, THETA_STEP_LIMIT);
}

/** Computes Fisher information for a complete item response vector. */
function getInformation(itemResponses: IrtItemResponse[], theta: number) {
  return itemResponses.reduce((total, itemResponse) => {
    const discrimination = getDiscrimination(itemResponse.item);
    const expected = getExpectedProbability(itemResponse.item, theta);

    return total + discrimination * discrimination * expected * (1 - expected);
  }, 0);
}

/** Returns the 2PL expected correctness probability for one item. */
function getExpectedProbability(item: Doc<"irtScaleItems">, theta: number) {
  const discrimination = getDiscrimination(item);
  const exponent = -discrimination * (theta - item.difficulty);

  return 1 / (1 + Math.exp(exponent));
}

/** Rejects invalid IRT item parameters before scoring. */
function getDiscrimination(item: Doc<"irtScaleItems">) {
  if (item.discrimination > 0) {
    return item.discrimination;
  }

  throw new ConvexError({
    code: "TRYOUT_IRT_ITEM_INVALID",
    message: "IRT item discrimination must be positive.",
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

/** Converts raw correctness into the public percentage score. */
function getRawPercentage(correctAnswers: number, totalQuestions: number) {
  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((correctAnswers / totalQuestions) * 100);
}

/** Converts theta into the public IRT score scale. */
function getPublishedIrtScore(theta: number) {
  const score = IRT_SCORE_MEAN + theta * IRT_SCORE_STANDARD_DEVIATION;

  return clamp(Math.round(score), 0, 1000);
}

/** Returns the final attempt status from the deadline and submission time. */
function getAttemptStatus(attempt: TryoutAttempt, now: number) {
  if (now >= attempt.expiresAt) {
    return "expired";
  }

  return "completed";
}

/** Returns the final attempt reason from the deadline and submission time. */
function getEndReason(attempt: TryoutAttempt, now: number) {
  if (now >= attempt.expiresAt) {
    return "time-expired";
  }

  return "submitted";
}

/** Clamps numeric estimates and public scores into their allowed range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
