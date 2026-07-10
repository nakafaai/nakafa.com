import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  materialLocaleRowValidator,
  materialRowValidator,
  syncSummaryValidator,
} from "@repo/backend/convex/contentSync/mutations/readModels/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Upserts curriculum-neutral material read models from typed material sources. */
export const bulkSyncMaterials = internalMutation({
  args: {
    materials: v.array(materialRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncMaterials",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedMaterials,
      received: args.materials.length,
      unit: "materials",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const material of args.materials) {
      const existing = await ctx.db
        .query("materials")
        .withIndex("by_key", (q) => q.eq("key", material.key))
        .unique();

      if (existing) {
        await ctx.db.patch("materials", existing._id, {
          ...material,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("materials", {
        ...material,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts localized material asset read models from MDX and material sources. */
export const bulkSyncMaterialLocales = internalMutation({
  args: {
    locales: v.array(materialLocaleRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncMaterialLocales",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedMaterialLocales,
      received: args.locales.length,
      unit: "material locales",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const locale of args.locales) {
      const existing = await ctx.db
        .query("materialLocales")
        .withIndex("by_locale_and_materialKey_and_sectionKey", (q) =>
          q
            .eq("locale", locale.locale)
            .eq("materialKey", locale.materialKey)
            .eq("sectionKey", locale.sectionKey)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("materialLocales", existing._id, {
          ...locale,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("materialLocales", {
        ...locale,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});
