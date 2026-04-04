import { internalMutation } from "@repo/backend/convex/functions";
import { upsertUserTryoutCatalogStatuses } from "@repo/backend/convex/tryouts/helpers/latest";
import { v } from "convex/values";

const USER_TRYOUT_CATALOG_STATUS_BACKFILL_BATCH_SIZE = 200;
const catalogStatusBackfillResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  pageSize: v.number(),
});

/**
 * Rebuild the per-user hub badge summary from the latest-attempt projection.
 *
 * This is a bounded repair entrypoint for schema rollouts or operational drift.
 * Rerun it with the returned cursor until `isDone` becomes `true`.
 */
export const backfillUserTryoutCatalogStatuses = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: catalogStatusBackfillResultValidator,
  handler: async (ctx, args) => {
    const latestAttemptPage = await ctx.db
      .query("userTryoutLatestAttempts")
      .withIndex("by_userId_and_product_and_locale_and_updatedAt")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: USER_TRYOUT_CATALOG_STATUS_BACKFILL_BATCH_SIZE,
      });

    for (const latestAttempt of latestAttemptPage.page) {
      await upsertUserTryoutCatalogStatuses(ctx, {
        attempt: {
          expiresAt: latestAttempt.expiresAtMs,
          status: latestAttempt.status,
          userId: latestAttempt.userId,
        },
        tryout: {
          locale: latestAttempt.locale,
          product: latestAttempt.product,
          slug: latestAttempt.slug,
        },
        updatedAt: latestAttempt.updatedAt,
      });
    }

    return {
      continueCursor: latestAttemptPage.continueCursor,
      isDone: latestAttemptPage.isDone,
      pageSize: latestAttemptPage.page.length,
    };
  },
});
