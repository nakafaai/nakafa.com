import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutScoringStrategyValidator } from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";

export const tryoutScaleIntegrityItemValidator = v.object({
  id: v.id("tryoutSets"),
  isActive: v.boolean(),
  locale: localeValidator,
  publicPath: v.string(),
  scoringStrategy: tryoutScoringStrategyValidator,
  hasPublishedScale: v.boolean(),
});

/** Returns whether the try-out set has at least one published IRT scale. */
async function hasPublishedScale(ctx: QueryCtx, tryoutSetId: Id<"tryoutSets">) {
  const scale = await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
      q.eq("tryoutSetId", tryoutSetId)
    )
    .order("desc")
    .first();

  return scale !== null;
}

/** Returns one bounded try-out scale integrity page for sync verification. */
export async function listIntegrityTryoutScalesPageImpl(
  ctx: QueryCtx,
  args: { paginationOpts: { cursor: string | null; numItems: number } }
) {
  const page = await ctx.db.query("tryoutSets").paginate(args.paginationOpts);
  const items = await Promise.all(
    page.page.map(async (set) => ({
      id: set._id,
      isActive: set.isActive,
      locale: set.locale,
      publicPath: set.publicPath,
      scoringStrategy: set.scoringStrategy,
      hasPublishedScale: await hasPublishedScale(ctx, set._id),
    }))
  );

  return {
    ...page,
    page: items,
  };
}
