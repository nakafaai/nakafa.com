import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { syncTryoutPartSetMappings } from "@repo/backend/convex/contentSync/lib/tryouts";
import { internalMutation } from "@repo/backend/convex/functions";
import { enqueueScaleQualityRefresh } from "@repo/backend/convex/irt/helpers/queue";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/convex/irt/scales/publish";
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

const SCALE_QUALITY_QUEUE_DRAIN_DELAY_MS = 1;

/** Detect, upsert, and deactivate tryouts for one locale/product pair. */
export const bulkSyncTryouts = internalMutation({
  args: {
    locale: localeValidator,
    product: tryoutProductValidator,
  },
  returns: syncTryoutsResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    let enqueuedScaleQualityRefresh = false;
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
    const orderedDetectedTryouts = [...detectedTryouts].sort(
      tryoutProductPolicies[args.product].compareTryouts
    );
    const detectedSlugs = new Set(
      orderedDetectedTryouts.map((tryout) => tryout.slug)
    );
    const activeTryoutCount = orderedDetectedTryouts.reduce(
      (count, tryout) => count + (tryout.isActive ? 1 : 0),
      0
    );

    // Persist dense browse positions so the paginated index can serve the final
    // catalog order directly.
    for (const [index, tryout] of orderedDetectedTryouts.entries()) {
      const catalogPosition = index + 1;
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
          existingTryout.isActive !== tryout.isActive ||
          existingTryout.catalogPosition !== catalogPosition ||
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

            const enqueued = await enqueueScaleQualityRefresh(ctx, {
              tryoutId: existingTryout._id,
              enqueuedAt: now,
            });

            if (enqueued) {
              enqueuedScaleQualityRefresh = true;
            }
          }

          unchanged++;
          continue;
        }

        await ctx.db.patch("tryouts", existingTryout._id, {
          catalogPosition,
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

        const enqueued = await enqueueScaleQualityRefresh(ctx, {
          tryoutId: existingTryout._id,
          enqueuedAt: now,
        });

        if (enqueued) {
          enqueuedScaleQualityRefresh = true;
        }

        updated++;
        continue;
      }

      const tryoutId = await ctx.db.insert("tryouts", {
        catalogPosition,
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

      const enqueued = await enqueueScaleQualityRefresh(ctx, {
        tryoutId,
        enqueuedAt: now,
      });

      if (enqueued) {
        enqueuedScaleQualityRefresh = true;
      }

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

      const enqueued = await enqueueScaleQualityRefresh(ctx, {
        tryoutId: activeTryout._id,
        enqueuedAt: now,
      });

      if (enqueued) {
        enqueuedScaleQualityRefresh = true;
      }

      updated++;
    }

    const existingCatalogMeta = await ctx.db
      .query("tryoutCatalogMeta")
      .withIndex("by_product_and_locale", (q) =>
        q.eq("product", args.product).eq("locale", args.locale)
      )
      .unique();

    if (!existingCatalogMeta) {
      await ctx.db.insert("tryoutCatalogMeta", {
        activeCount: activeTryoutCount,
        locale: args.locale,
        product: args.product,
        updatedAt: now,
      });
    } else if (existingCatalogMeta.activeCount !== activeTryoutCount) {
      await ctx.db.patch("tryoutCatalogMeta", existingCatalogMeta._id, {
        activeCount: activeTryoutCount,
        updatedAt: now,
      });
    }

    if (enqueuedScaleQualityRefresh) {
      // A positive delay keeps the drain effectively immediate while avoiding
      // same-timestamp scheduler edge cases in JavaScript test runtimes.
      await ctx.scheduler.runAfter(
        SCALE_QUALITY_QUEUE_DRAIN_DELAY_MS,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return { created, unchanged, updated };
  },
});
