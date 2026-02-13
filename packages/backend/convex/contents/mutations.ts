import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import { contentPopularity } from "@repo/backend/convex/contents/aggregate";
import { v } from "convex/values";

/**
 * Calculates priority scores from aggregate data and updates queue.
 * Runs every 30 minutes via cron.
 */
export const aggregatePopularity = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    let totalProcessed = 0;
    let totalQueued = 0;

    for (const locale of SUPPORTED_LOCALES) {
      const count = await contentPopularity.count(ctx, { namespace: locale });
      totalProcessed += count;

      // Get top content by popularity
      const popular = await contentPopularity.paginate(ctx, {
        namespace: locale,
        order: "desc",
        pageSize: 100,
      });

      // Queue high-priority content for audio generation
      for (const item of popular.page) {
        const [contentType, contentId] = item.key;
        const viewCount = item.sumValue;

        // Minimum view threshold check
        if (viewCount < MIN_VIEW_THRESHOLD) {
          continue;
        }

        // Check if already queued
        const existing = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("content", (q) =>
            q
              .eq("contentId", contentId)
              .eq("contentType", contentType)
              .eq("locale", locale)
          )
          .first();

        if (existing) {
          continue;
        }

        // Calculate priority score
        const priorityScore = viewCount * 10;

        await ctx.db.insert("audioGenerationQueue", {
          contentId,
          contentType,
          locale,
          priorityScore,
          status: "pending",
          requestedAt: Date.now(),
          retryCount: 0,
          maxRetries: RETRY_CONFIG.maxRetries,
          updatedAt: Date.now(),
        });

        totalQueued++;
      }
    }

    return { processed: totalProcessed, queued: totalQueued };
  },
});
