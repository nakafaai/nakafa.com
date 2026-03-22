import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { internalMutation } from "@repo/backend/convex/functions";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/convex/irt/scaleVersions";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  detectTryoutsForProduct,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import type { TryoutPartKey } from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

const syncTryoutsResultValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

async function syncTryoutPartSetMappings(
  ctx: MutationCtx,
  args: {
    parts: Array<{
      partKey: TryoutPartKey;
      setId: Id<"exerciseSets">;
    }>;
    tryoutId: Id<"tryouts">;
  }
) {
  const existingMappings = await getManyFrom(
    ctx.db,
    "tryoutPartSets",
    "tryoutId_partIndex",
    args.tryoutId,
    "tryoutId"
  );
  const hasChanges =
    existingMappings.length !== args.parts.length ||
    existingMappings.some(
      (mapping) =>
        args.parts[mapping.partIndex]?.setId !== mapping.setId ||
        args.parts[mapping.partIndex]?.partKey !== mapping.partKey
    );

  if (!hasChanges) {
    return false;
  }

  for (const existingMapping of existingMappings) {
    await ctx.db.delete("tryoutPartSets", existingMapping._id);
  }

  for (const [partIndex, part] of args.parts.entries()) {
    await ctx.db.insert("tryoutPartSets", {
      partIndex,
      partKey: part.partKey,
      setId: part.setId,
      tryoutId: args.tryoutId,
    });
  }

  return true;
}

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
      .withIndex("locale_type_exerciseType", (q) =>
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

    const detectedTryouts = detectTryoutsForProduct({
      locale: args.locale,
      product: args.product,
      sets: tryoutCandidateSets,
    });
    const detectedSlugs = new Set(detectedTryouts.map((tryout) => tryout.slug));

    for (const tryout of detectedTryouts) {
      const existingTryout = await ctx.db
        .query("tryouts")
        .withIndex("product_locale_cycleKey_slug", (q) =>
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
          }

          unchanged++;
          continue;
        }

        await ctx.db.patch("tryouts", existingTryout._id, {
          isActive: true,
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

      created++;
    }

    const activeTryouts = await ctx.db
      .query("tryouts")
      .withIndex("product_locale_isActive", (q) =>
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
      updated++;
    }

    return { created, unchanged, updated };
  },
});
