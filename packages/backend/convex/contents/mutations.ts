import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import {
  articlePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/**
 * Populates the audio generation queue with popular content.
 * Runs every 30 minutes via cron.
 *
 * Purpose:
 * - Reads popularity aggregates (articles and subjects only)
 * - Queues top content for audio generation
 * - Exercises are NOT queued (they don't have audio)
 *
 * Type Safety:
 * - Uses discriminated union for type-safe content references
 * - TypeScript infers exact ID types via as const pattern
 * - No explicit interfaces or type annotations needed
 *
 * Scalability:
 * - Parallel query execution for all content types
 * - O(log n) lookups via aggregate indexes
 * - Batched processing (top 100 per locale)
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    let totalProcessed = 0;
    let totalQueued = 0;

    for (const locale of SUPPORTED_LOCALES) {
      // Query article and subject aggregates (exercises excluded - no audio)
      const [articleCount, subjectCount] = await Promise.all([
        articlePopularity.count(ctx, { namespace: locale }),
        subjectPopularity.count(ctx, { namespace: locale }),
      ]);

      totalProcessed += articleCount + subjectCount;

      // Get top content from articles and subjects
      const [popularArticles, popularSubjects] = await Promise.all([
        articlePopularity.paginate(ctx, {
          namespace: locale,
          order: "desc",
          pageSize: 50,
        }),
        subjectPopularity.paginate(ctx, {
          namespace: locale,
          order: "desc",
          pageSize: 50,
        }),
      ]);

      // Build unified list with inferred discriminated union types
      // Extract contentId from composite key [viewCount, contentId]
      const items = [
        ...popularArticles.page.map((item) => ({
          type: "article" as const,
          id: item.key[1], // Extract contentId from [viewCount, contentId]
          sumValue: item.sumValue,
        })),
        ...popularSubjects.page.map((item) => ({
          type: "subject" as const,
          id: item.key[1], // Extract contentId from [viewCount, contentId]
          sumValue: item.sumValue,
        })),
      ];

      // Sort by popularity (descending)
      items.sort((a, b) => b.sumValue - a.sumValue);

      // Process top 100 items
      for (const item of items.slice(0, 100)) {
        if (item.sumValue < MIN_VIEW_THRESHOLD) {
          continue;
        }

        // Build discriminated contentRef
        const contentRef =
          item.type === "article"
            ? { type: "article" as const, id: item.id }
            : { type: "subject" as const, id: item.id };

        // Check if already queued
        const existing = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("contentRef_locale", (q) =>
            q
              .eq("contentRef.type", contentRef.type)
              .eq("contentRef.id", contentRef.id)
              .eq("locale", locale)
          )
          .first();

        if (existing) {
          if (
            existing.status === "pending" ||
            existing.status === "processing"
          ) {
            continue;
          }
          await ctx.db.delete("audioGenerationQueue", existing._id);
        }

        // Queue for audio generation
        await ctx.db.insert("audioGenerationQueue", {
          contentRef,
          locale,
          priorityScore: item.sumValue * 10,
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
