import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  estimateIrtScore,
  type IrtItemAnswer,
} from "@repo/backend/convex/tryouts/runtime/estimate";
import type { AttemptScore } from "@repo/backend/convex/tryouts/runtime/result";
import { getRawPercentage } from "@repo/backend/convex/tryouts/runtime/result";
import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

/** Scores an entire IRT attempt from its immutable scale and placement snapshots. */
export async function scoreIrtAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
  }
): Promise<AttemptScore> {
  const scale = await requireAttemptScale(ctx, args.attempt);
  const [items, placements] = await Promise.all([
    loadAttemptScaleItems(ctx, scale, args.attempt.totalQuestions),
    loadAttemptPlacements(ctx, args.attempt),
  ]);

  return buildIrtScore({
    items,
    placements,
    responses: args.responses,
    scale,
    scoringStrategy: args.scoringStrategy,
    totalQuestions: args.attempt.totalQuestions,
  });
}

/** Scores one IRT section from the same immutable scale as its parent attempt. */
export async function scoreIrtSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    responses: TryoutResponse[];
    scoringStrategy: TryoutScoringStrategy;
    totalQuestions: number;
    tryoutSectionId: Id<"tryoutSections">;
  }
): Promise<AttemptScore> {
  const scale = await requireAttemptScale(ctx, args.attempt);
  const placements = await loadSectionPlacements(ctx, args);
  const items = await loadSectionScaleItems(ctx, { placements, scale });

  return buildIrtScore({
    items,
    placements,
    responses: args.responses,
    scale,
    scoringStrategy: args.scoringStrategy,
    totalQuestions: args.totalQuestions,
  });
}

/** Loads the IRT scale that should be used for one set or attempt snapshot. */
export async function requireIrtScaleVersion(
  ctx: MutationCtx,
  args: {
    scaleVersionId?: Id<"irtScaleVersions">;
    tryoutSetId: Id<"tryoutSets">;
  }
) {
  if (args.scaleVersionId) {
    const scale = await ctx.db.get(args.scaleVersionId);

    if (scale?.tryoutSetId === args.tryoutSetId) {
      return scale;
    }

    throw new ConvexError({
      code: "TRYOUT_IRT_SCALE_REQUIRED",
      message: "Attempt IRT scale is missing for this try-out.",
    });
  }

  const scale = await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
      q.eq("tryoutSetId", args.tryoutSetId)
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

/** Loads and validates the scale version frozen by one attempt. */
async function requireAttemptScale(ctx: MutationCtx, attempt: TryoutAttempt) {
  const scale = await requireIrtScaleVersion(ctx, {
    scaleVersionId: attempt.scaleVersionId,
    tryoutSetId: attempt.tryoutSetId,
  });

  if (scale.questionCount !== attempt.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_IRT_SCALE_COUNT_MISMATCH",
      message: "IRT scale question count does not match the attempt.",
    });
  }

  return scale;
}

/** Loads the complete placement snapshot used by attempt-level IRT scoring. */
async function loadAttemptPlacements(ctx: MutationCtx, attempt: TryoutAttempt) {
  const placements = await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.totalQuestions + 1);

  if (placements.length !== attempt.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      message: "Try-out placement count does not match the attempt snapshot.",
    });
  }

  return placements;
}

/** Loads the exact placement snapshot for one attempt section. */
async function loadSectionPlacements(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    totalQuestions: number;
    tryoutSectionId: Id<"tryoutSections">;
  }
) {
  const placements = await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex(
      "by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder",
      (q) =>
        q
          .eq("tryoutAttemptId", args.attempt._id)
          .eq("tryoutSectionId", args.tryoutSectionId)
    )
    .take(args.totalQuestions + 1);

  if (placements.length !== args.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      message: "Try-out placement count does not match the section snapshot.",
    });
  }

  return placements;
}

/** Loads every item in the attempt's complete scale snapshot. */
async function loadAttemptScaleItems(
  ctx: MutationCtx,
  scale: Doc<"irtScaleVersions">,
  totalQuestions: number
) {
  const items = await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
      q.eq("scaleVersionId", scale._id)
    )
    .take(totalQuestions + 1);

  if (items.length !== totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_IRT_ITEM_COUNT_MISMATCH",
      message: "IRT scale item count does not match the attempt.",
    });
  }

  return items;
}

/** Loads only the indexed scale items required by one section. */
async function loadSectionScaleItems(
  ctx: MutationCtx,
  args: {
    placements: TryoutPlacement[];
    scale: Doc<"irtScaleVersions">;
  }
) {
  return await Promise.all(
    args.placements.map(async (placement) => {
      const item = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
          q
            .eq("scaleVersionId", args.scale._id)
            .eq("questionSourceKey", placement.questionSourceKey)
        )
        .unique();

      if (item && matchesPlacementSnapshot(item, placement)) {
        return item;
      }

      throw new ConvexError({
        code: "TRYOUT_IRT_ITEM_STALE",
        message: "IRT scale item is missing or stale for one try-out question.",
      });
    })
  );
}

/** Builds one score result from calibrated items and captured responses. */
function buildIrtScore(args: {
  items: Doc<"irtScaleItems">[];
  placements: TryoutPlacement[];
  responses: TryoutResponse[];
  scale: Doc<"irtScaleVersions">;
  scoringStrategy: TryoutScoringStrategy;
  totalQuestions: number;
}): AttemptScore {
  const itemAnswers = loadIrtItemAnswers(args);
  const estimate = estimateIrtScore(itemAnswers);
  const correctAnswers = itemAnswers.filter(
    (answer) => answer.isCorrect
  ).length;

  return {
    publishedScore: estimate.publishedScore,
    rawScore: getRawPercentage(correctAnswers, args.totalQuestions),
    scaleVersionId: args.scale._id,
    scoreStatus: args.scale.status,
    scoringStrategy: args.scoringStrategy,
    theta: estimate.theta,
    thetaSE: estimate.thetaSE,
    totalCorrect: correctAnswers,
    totalQuestions: args.totalQuestions,
  };
}

/** Joins scale, placement, and response snapshots without source fallbacks. */
function loadIrtItemAnswers(args: {
  items: Doc<"irtScaleItems">[];
  placements: TryoutPlacement[];
  responses: TryoutResponse[];
}) {
  const responsesByPlacement = new Map(
    args.responses.map((response) => [response.placementId, response])
  );
  const placementsBySourceKey = getPlacementsBySourceKey(args.placements);

  return args.items.map((item): IrtItemAnswer => {
    const placement = placementsBySourceKey.get(item.questionSourceKey);

    if (!(placement && matchesPlacementSnapshot(item, placement))) {
      throw new ConvexError({
        code: "TRYOUT_IRT_ITEM_STALE",
        message: "IRT scale item is missing or stale for one try-out question.",
      });
    }

    return {
      isCorrect: Boolean(responsesByPlacement.get(placement._id)?.isCorrect),
      item,
    };
  });
}

/** Indexes placement snapshots by source key and rejects duplicate rows. */
function getPlacementsBySourceKey(placements: TryoutPlacement[]) {
  const placementsBySourceKey = new Map<string, TryoutPlacement>();

  for (const placement of placements) {
    if (placementsBySourceKey.has(placement.questionSourceKey)) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_DUPLICATE",
        message: "Try-out placement has a duplicate question source key.",
      });
    }

    placementsBySourceKey.set(placement.questionSourceKey, placement);
  }

  return placementsBySourceKey;
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
