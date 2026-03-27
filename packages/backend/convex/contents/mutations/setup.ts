import { CONTENT_ANALYTICS_PARTITIONS } from "@repo/backend/convex/contents/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/**
 * Ensures the partition lease table has exactly one row per configured partition.
 * Run this after introducing new analytics partitions or when repairing old data.
 */
export const initializeAnalyticsPartitions = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    repaired: v.number(),
  }),
  handler: async (ctx) => {
    let created = 0;
    let repaired = 0;

    for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
      const partitionRows = await ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", partition))
        .collect();

      partitionRows.sort((left, right) => {
        if (left.leaseVersion !== right.leaseVersion) {
          return right.leaseVersion - left.leaseVersion;
        }

        if (left.leaseExpiresAt !== right.leaseExpiresAt) {
          return right.leaseExpiresAt - left.leaseExpiresAt;
        }

        return left._creationTime - right._creationTime;
      });

      const partitionRow = partitionRows.at(0) ?? null;

      for (const duplicateRow of partitionRows.slice(1)) {
        await ctx.db.delete("contentAnalyticsPartitions", duplicateRow._id);
        repaired++;
      }

      if (partitionRow) {
        continue;
      }

      await ctx.db.insert("contentAnalyticsPartitions", {
        partition,
        leaseExpiresAt: 0,
        leaseVersion: 0,
      });
      created++;
    }

    if (created > 0 || repaired > 0) {
      logger.info("Initialized content analytics partitions", {
        created,
        repaired,
      });
    }

    return { created, repaired };
  },
});
