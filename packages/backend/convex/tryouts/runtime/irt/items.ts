import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;

/** Returns the single ownership mode that controls every IRT snapshot join. */
export function getIrtOwnership(
  attempt: Pick<TryoutAttempt, "tryoutSnapshotId">
) {
  return attempt.tryoutSnapshotId ? "signed" : "filesystem";
}

export type IrtOwnership = ReturnType<typeof getIrtOwnership>;

/** Loads the IRT scale that should be used for one set or attempt snapshot. */
export async function requireIrtScaleVersion(
  ctx: MutationCtx,
  attempt: TryoutAttempt
) {
  if (attempt.scaleVersionId) {
    const scale = await ctx.db.get(attempt.scaleVersionId);

    if (scale && scaleBelongsToAttempt(scale, attempt)) {
      return scale;
    }

    throw new ConvexError({
      code: "TRYOUT_IRT_SCALE_REQUIRED",
      message: "Attempt IRT scale is missing for this try-out.",
    });
  }

  if (!attempt.tryoutSetId || attempt.tryoutSnapshotId) {
    throw new ConvexError({
      code: "TRYOUT_IRT_SCALE_REQUIRED",
      message: "Attempt IRT scale is missing for this try-out.",
    });
  }

  const scale = await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (query) =>
      query.eq("tryoutSetId", attempt.tryoutSetId)
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
  const scale = await requireIrtScaleVersion(ctx, attempt);

  if (
    attempt.tryoutSnapshotId &&
    attempt.setIdentity &&
    ((scale.tryoutSnapshotId !== undefined &&
      scale.tryoutSnapshotId !== attempt.tryoutSnapshotId) ||
      scale.setIdentity !== attempt.setIdentity)
  ) {
    throw new ConvexError({
      code: "TRYOUT_IRT_SCALE_REQUIRED",
      message: "Attempt IRT scale belongs to another signed try-out.",
    });
  }

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
    sectionKey: string;
    totalQuestions: number;
    tryoutSectionId?: Id<"tryoutSections">;
  }
) {
  const placements = args.attempt.tryoutSnapshotId
    ? await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (query) =>
            query
              .eq("tryoutAttemptId", args.attempt._id)
              .eq("sectionKey", args.sectionKey)
        )
        .take(args.totalQuestions + 1)
    : await loadFilesystemSectionPlacements(ctx, args);

  if (placements.length !== args.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      message: "Try-out placement count does not match the section snapshot.",
    });
  }

  return placements;
}

/** Loads filesystem placements only when their section identifier is present. */
function loadFilesystemSectionPlacements(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    totalQuestions: number;
    tryoutSectionId?: Id<"tryoutSections">;
  }
) {
  if (!args.tryoutSectionId) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_IDENTITY_REQUIRED",
      message: "Filesystem try-out placement has no section identity.",
    });
  }

  return ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex(
      "by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder",
      (query) =>
        query
          .eq("tryoutAttemptId", args.attempt._id)
          .eq("tryoutSectionId", args.tryoutSectionId)
    )
    .take(args.totalQuestions + 1);
}

/** Verifies one frozen scale belongs to the same filesystem or signed attempt. */
function scaleBelongsToAttempt(
  scale: Doc<"irtScaleVersions">,
  attempt: TryoutAttempt
) {
  if (!attempt.tryoutSnapshotId) {
    return Boolean(
      attempt.tryoutSetId && scale.tryoutSetId === attempt.tryoutSetId
    );
  }

  return Boolean(
    attempt.setIdentity &&
      scale.setIdentity === attempt.setIdentity &&
      (scale.tryoutSnapshotId === undefined ||
        scale.tryoutSnapshotId === attempt.tryoutSnapshotId) &&
      (scale.tryoutSetId === undefined ||
        scale.tryoutSetId === attempt.tryoutSetId)
  );
}

/** Loads every item in the attempt's complete scale snapshot. */
export async function loadAttemptScaleItems(
  ctx: MutationCtx,
  scale: Doc<"irtScaleVersions">,
  totalQuestions: number
) {
  const items = await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
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
    ownership: IrtOwnership;
    placements: TryoutPlacement[];
    scale: Doc<"irtScaleVersions">;
  }
) {
  return await Promise.all(
    args.placements.map(async (placement) => {
      const items =
        args.ownership === "signed"
          ? await ctx.db
              .query("irtScaleItems")
              .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
                query
                  .eq("scaleVersionId", args.scale._id)
                  .eq("placementIdentity", placement.placementIdentity)
              )
              .take(2)
          : await loadLegacyScaleItems(ctx, args.scale._id, placement);
      const item = items.length === 1 ? items[0] : null;

      if (item && matchesPlacementSnapshot(item, placement, args.ownership)) {
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
  placement: TryoutPlacement,
  ownership: IrtOwnership
) {
  if (ownership === "signed") {
    return (
      placement.placementIdentity !== undefined &&
      placement.placementRowHash !== undefined &&
      item.placementIdentity === placement.placementIdentity &&
      item.placementRowHash === placement.placementRowHash
    );
  }

  return (
    item.contentHash === placement.contentHash &&
    item.questionId !== undefined &&
    item.questionId === placement.questionId &&
    item.sourceRevision === placement.sourceRevision
  );
}

/** Loads one filesystem-owned scale item without weakening signed joins. */
async function loadLegacyScaleItems(
  ctx: MutationCtx,
  scaleVersionId: Id<"irtScaleVersions">,
  placement: TryoutPlacement
) {
  if (!placement.questionSourceKey) {
    throw new ConvexError({
      code: "TRYOUT_PLACEMENT_IDENTITY_REQUIRED",
      message: "Try-out placement has no signed or filesystem identity.",
    });
  }

  return await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_questionSourceKey", (query) =>
      query
        .eq("scaleVersionId", scaleVersionId)
        .eq("questionSourceKey", placement.questionSourceKey)
    )
    .take(2);
}
