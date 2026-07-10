import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  assessmentNodeRowValidator,
  generatedProgramRowValidator,
  syncSummaryValidator,
} from "@repo/backend/convex/contentSync/mutations/readModels/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Upserts assessment/exam identities into the final read model. */
export const bulkSyncAssessments = internalMutation({
  args: {
    assessments: v.array(generatedProgramRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncAssessments",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedAssessments,
      received: args.assessments.length,
      unit: "assessments",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const assessment of args.assessments) {
      const existing = await ctx.db
        .query("assessments")
        .withIndex("by_key", (query) => query.eq("key", assessment.key))
        .unique();

      const row = {
        ...assessment,
        syncedAt: args.syncedAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated++;
        continue;
      }

      await ctx.db.insert("assessments", row);
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts assessment-owned outline nodes into the final read model. */
export const bulkSyncAssessmentNodes = internalMutation({
  args: {
    nodes: v.array(assessmentNodeRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncAssessmentNodes",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedAssessmentNodes,
      received: args.nodes.length,
      unit: "assessment nodes",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const node of args.nodes) {
      const existing = await ctx.db
        .query("assessmentNodes")
        .withIndex("by_assessmentKey_and_key", (query) =>
          query.eq("assessmentKey", node.assessmentKey).eq("key", node.key)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("assessmentNodes", existing._id, {
          ...node,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("assessmentNodes", {
        ...node,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});
