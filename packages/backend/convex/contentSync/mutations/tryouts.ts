import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { syncTryoutPartSetMappings } from "@repo/backend/convex/contentSync/lib/tryouts";
import { internalMutation } from "@repo/backend/convex/functions";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/convex/irt/scales/publish";
import { irtScaleQualityRefreshWorkpool } from "@repo/backend/convex/irt/workpool";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  tryoutProductPolicies,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";

const syncTryoutsResultValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

/** Detect, upsert, and deactivate tryouts for one locale/product pair. */
export const bulkSyncTryouts = internalMutation({
  args: {
    locale: localeValidator,
    product: tryoutProductValidator,
  },
  returns: syncTryoutsResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    const tryoutCandidateLimit = CONTENT_SYNC_BATCH_LIMITS.tryoutDetectionSets;
    const tryoutCandidateSets = await ctx.db
      .query("exerciseSets")
      .withIndex("by_locale_and_type_and_exerciseType", (q) =>
        q
          .eq("locale", args.locale)
          .eq("type", args.product)
          .eq("exerciseType", "try-out")
      )
      .take(tryoutCandidateLimit + 1);

    assertContentSyncBatchSize({
      functionName: "bulkSyncTryouts",
      limit: tryoutCandidateLimit,
      received: tryoutCandidateSets.length,
      unit: "tryout candidate sets",
    });

    const detectedTryouts = tryoutProductPolicies[args.product].detectTryouts({
      locale: args.locale,
      sets: tryoutCandidateSets,
    });
    const detectedSlugs = new Set(detectedTryouts.map((tryout) => tryout.slug));

    for (const tryout of detectedTryouts) {
      const existingTryout = await ctx.db
        .query("tryouts")
        .withIndex("by_product_and_locale_and_cycleKey_and_slug", (q) =>
          q
            .eq("product", tryout.product)
            .eq("locale", tryout.locale)
            .eq("cycleKey", tryout.cycleKey)
            .eq("slug", tryout.slug)
        )
        .unique();

      if (existingTryout) {
        const mappingsChanged = await syncTryoutPartSetMappings(ctx, {
          parts: tryout.parts,
          tryoutId: existingTryout._id,
        });
        const hasChanges =
          !existingTryout.isActive ||
          existingTryout.label !== tryout.label ||
          existingTryout.partCount !== tryout.partCount ||
          existingTryout.totalQuestionCount !== tryout.totalQuestionCount ||
          mappingsChanged;

        if (!hasChanges) {
          if (existingTryout.isActive) {
            await getOrPublishScaleVersionForTryout(ctx.db, {
              now,
              tryoutId: existingTryout._id,
            });

            await irtScaleQualityRefreshWorkpool.enqueueMutation(
              ctx,
              internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
              { tryoutId: existingTryout._id }
            );
          }

          unchanged++;
          continue;
        }

        await ctx.db.patch("tryouts", existingTryout._id, {
          isActive: tryout.isActive,
          label: tryout.label,
          partCount: tryout.partCount,
          syncedAt: now,
          totalQuestionCount: tryout.totalQuestionCount,
        });

        if (tryout.isActive) {
          await getOrPublishScaleVersionForTryout(ctx.db, {
            now,
            tryoutId: existingTryout._id,
          });
        }

        await irtScaleQualityRefreshWorkpool.enqueueMutation(
          ctx,
          internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
          { tryoutId: existingTryout._id }
        );

        updated++;
        continue;
      }

      const tryoutId = await ctx.db.insert("tryouts", {
        cycleKey: tryout.cycleKey,
        detectedAt: now,
        isActive: tryout.isActive,
        label: tryout.label,
        locale: tryout.locale,
        partCount: tryout.partCount,
        product: tryout.product,
        slug: tryout.slug,
        syncedAt: now,
        totalQuestionCount: tryout.totalQuestionCount,
      });

      await syncTryoutPartSetMappings(ctx, {
        parts: tryout.parts,
        tryoutId,
      });

      if (tryout.isActive) {
        await getOrPublishScaleVersionForTryout(ctx.db, {
          now,
          tryoutId,
        });
      }

      await irtScaleQualityRefreshWorkpool.enqueueMutation(
        ctx,
        internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
        { tryoutId }
      );

      created++;
    }

    const activeTryouts = await ctx.db
      .query("tryouts")
      .withIndex("by_product_and_locale_and_isActive", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .take(tryoutCandidateLimit + 1);

    assertContentSyncBatchSize({
      functionName: "bulkSyncTryouts",
      limit: tryoutCandidateLimit,
      received: activeTryouts.length,
      unit: "active tryouts",
    });

    for (const activeTryout of activeTryouts) {
      if (detectedSlugs.has(activeTryout.slug)) {
        continue;
      }

      await ctx.db.patch("tryouts", activeTryout._id, {
        isActive: false,
        syncedAt: now,
      });

      await irtScaleQualityRefreshWorkpool.enqueueMutation(
        ctx,
        internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
        { tryoutId: activeTryout._id }
      );

      updated++;
    }

    return { created, unchanged, updated };
  },
});
