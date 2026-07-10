import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  curriculumMaterialRowValidator,
  curriculumNodeRowValidator,
  generatedProgramRowValidator,
  syncSummaryValidator,
} from "@repo/backend/convex/contentSync/mutations/readModels/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Upserts canonical curriculum/program identities into the final read model. */
export const bulkSyncCurricula = internalMutation({
  args: {
    curricula: v.array(generatedProgramRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurricula",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurricula,
      received: args.curricula.length,
      unit: "curricula",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const curriculum of args.curricula) {
      const existing = await ctx.db
        .query("curricula")
        .withIndex("by_key", (q) => q.eq("key", curriculum.key))
        .unique();

      const row = {
        ...curriculum,
        syncedAt: args.syncedAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated++;
        continue;
      }

      await ctx.db.insert("curricula", row);
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts curriculum-owned outline nodes into the final read model. */
export const bulkSyncCurriculumNodes = internalMutation({
  args: {
    nodes: v.array(curriculumNodeRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumNodes",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurriculumNodes,
      received: args.nodes.length,
      unit: "curriculum nodes",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const node of args.nodes) {
      const existing = await ctx.db
        .query("curriculumNodes")
        .withIndex("by_curriculumKey_and_key", (q) =>
          q.eq("curriculumKey", node.curriculumKey).eq("key", node.key)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("curriculumNodes", existing._id, {
          ...node,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curriculumNodes", {
        ...node,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts curriculum-to-material mappings into the final read model. */
export const bulkSyncCurriculumMaterials = internalMutation({
  args: {
    mappings: v.array(curriculumMaterialRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumMaterials",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurriculumMaterials,
      received: args.mappings.length,
      unit: "curriculum material mappings",
    });

    let created = 0;
    let updated = 0;

    for (const mapping of args.mappings) {
      const existing = await ctx.db
        .query("curriculumMaterials")
        .withIndex("by_curriculumKey_and_nodeKey_and_materialKey", (q) =>
          q
            .eq("curriculumKey", mapping.curriculumKey)
            .eq("nodeKey", mapping.nodeKey)
            .eq("materialKey", mapping.materialKey)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("curriculumMaterials", existing._id, {
          ...mapping,
          syncedAt: args.syncedAt,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curriculumMaterials", {
        ...mapping,
        syncedAt: args.syncedAt,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});
