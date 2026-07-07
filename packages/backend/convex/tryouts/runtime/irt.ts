import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { AttemptScore } from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/schema";
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

interface IrtItemResponse {
  isCorrect: boolean;
  item: Doc<"irtScaleItems">;
}

/** Scores an IRT set from the latest published item scale. */
export async function scoreIrtAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
  }
): Promise<AttemptScore> {
  const scale = await loadLatestScaleVersion(ctx, args.attempt);
  const placements = await loadAttemptPlacements(ctx, args.attempt);

  if (placements.length !== args.attempt.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      message: "IRT scoring requires every try-out question placement.",
    });
  }

  const itemResponses = await loadIrtItemResponses(ctx, {
    placements,
    responses: args.responses,
    scaleVersionId: scale._id,
  });
  const estimate = estimateTheta(itemResponses);
  const correctAnswers = args.responses.filter(
    (response) => response.isCorrect
  ).length;
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

/** Loads the placement snapshot used by IRT scoring. */
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

/** Clamps numeric estimates and public scores into their allowed range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
