import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;

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
    .withIndex("by_tryoutSetId_and_publishedAt", (query) =>
      query.eq("tryoutSetId", args.tryoutSetId)
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
export async function loadAttemptScale(
  ctx: MutationCtx,
  attempt: TryoutAttempt
) {
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
export async function loadAttemptPlacements(
  ctx: MutationCtx,
  attempt: TryoutAttempt
) {
  const placements = await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
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
export async function loadSectionPlacements(
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
      (query) =>
        query
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
export async function loadAttemptScaleItems(
  ctx: MutationCtx,
  scale: Doc<"irtScaleVersions">,
  totalQuestions: number
) {
  const items = await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_questionSourceKey", (query) =>
      query.eq("scaleVersionId", scale._id)
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
export async function loadSectionScaleItems(
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
        .withIndex("by_scaleVersionId_and_questionSourceKey", (query) =>
          query
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

/** Verifies that an IRT item belongs to the exact placed source snapshot. */
export function matchesPlacementSnapshot(
  item: Doc<"irtScaleItems">,
  placement: TryoutPlacement
) {
  return (
    item.contentHash === placement.contentHash &&
    item.questionId === placement.questionId &&
    item.sourceRevision === placement.sourceRevision
  );
}
