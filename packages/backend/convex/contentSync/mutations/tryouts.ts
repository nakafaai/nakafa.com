import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { syncTryoutPartSetMappings } from "@repo/backend/convex/contentSync/lib/tryouts";
import { internalMutation } from "@repo/backend/convex/functions";
import { enqueueScaleQualityRefresh } from "@repo/backend/convex/irt/helpers/queue";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/convex/irt/scales/publish";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  type DetectedTryout,
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
    const detectedSlugs = new Set(detectedTryouts.map((tryout) => tryout.slug));
    const activeCatalogCount = detectedTryouts.reduce(
      (count, tryout) => count + (tryout.isActive ? 1 : 0),
      0
    );
    const syncCatalogEntry = async ({
      tryout,
      tryoutId,
    }: {
      tryout: DetectedTryout;
      tryoutId: Id<"tryouts">;
    }) => {
      const existingCatalogEntry = await ctx.db
        .query("tryoutCatalogEntries")
        .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
        .unique();
      const nextCatalogEntry = {
        tryoutId,
        product: tryout.product,
        locale: tryout.locale,
        cycleKey: tryout.cycleKey,
        slug: tryout.slug,
        label: tryout.label,
        partCount: tryout.partCount,
        totalQuestionCount: tryout.totalQuestionCount,
        isActive: tryout.isActive,
        catalogSortKey:
          tryoutProductPolicies[tryout.product].getCatalogSortKey(tryout),
        updatedAt: now,
      };

      if (!existingCatalogEntry) {
        await ctx.db.insert("tryoutCatalogEntries", nextCatalogEntry);
        return true;
      }

      const hasChanges =
        existingCatalogEntry.product !== nextCatalogEntry.product ||
        existingCatalogEntry.locale !== nextCatalogEntry.locale ||
        existingCatalogEntry.cycleKey !== nextCatalogEntry.cycleKey ||
        existingCatalogEntry.slug !== nextCatalogEntry.slug ||
        existingCatalogEntry.label !== nextCatalogEntry.label ||
        existingCatalogEntry.partCount !== nextCatalogEntry.partCount ||
        existingCatalogEntry.totalQuestionCount !==
          nextCatalogEntry.totalQuestionCount ||
        existingCatalogEntry.isActive !== nextCatalogEntry.isActive ||
        existingCatalogEntry.catalogSortKey !== nextCatalogEntry.catalogSortKey;

      if (!hasChanges) {
        return false;
      }

      await ctx.db.patch("tryoutCatalogEntries", existingCatalogEntry._id, {
        catalogSortKey: nextCatalogEntry.catalogSortKey,
        cycleKey: nextCatalogEntry.cycleKey,
        isActive: nextCatalogEntry.isActive,
        label: nextCatalogEntry.label,
        locale: nextCatalogEntry.locale,
        partCount: nextCatalogEntry.partCount,
        product: nextCatalogEntry.product,
        slug: nextCatalogEntry.slug,
        totalQuestionCount: nextCatalogEntry.totalQuestionCount,
        updatedAt: now,
      });

      return true;
    };

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
        const catalogEntryChanged = await syncCatalogEntry({
          tryout,
          tryoutId: existingTryout._id,
        });
        const hasChanges =
          !existingTryout.isActive ||
          existingTryout.label !== tryout.label ||
          existingTryout.partCount !== tryout.partCount ||
          existingTryout.totalQuestionCount !== tryout.totalQuestionCount ||
          catalogEntryChanged ||
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
      await syncCatalogEntry({
        tryout,
        tryoutId,
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

      const activeCatalogEntry = await ctx.db
        .query("tryoutCatalogEntries")
        .withIndex("by_tryoutId", (q) => q.eq("tryoutId", activeTryout._id))
        .unique();

      await ctx.db.patch("tryouts", activeTryout._id, {
        isActive: false,
        syncedAt: now,
      });

      if (activeCatalogEntry?.isActive) {
        await ctx.db.patch("tryoutCatalogEntries", activeCatalogEntry._id, {
          isActive: false,
          updatedAt: now,
        });
      }

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
        activeCount: activeCatalogCount,
        locale: args.locale,
        product: args.product,
        updatedAt: now,
      });
    } else if (existingCatalogMeta.activeCount !== activeCatalogCount) {
      await ctx.db.patch("tryoutCatalogMeta", existingCatalogMeta._id, {
        activeCount: activeCatalogCount,
        updatedAt: now,
      });
    }

    if (enqueuedScaleQualityRefresh) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
        {}
      );
    }

    return { created, unchanged, updated };
  },
});
