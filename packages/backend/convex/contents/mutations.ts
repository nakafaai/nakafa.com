import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import {
  articlePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";
import { v } from "convex/values";

/**
 * Calculates priority scores from aggregate data and updates queue.
 * Runs every 30 minutes via cron.
 *
 * Type Safety:
 * - Uses two separate aggregates with simple ID keys (no tuples)
 * - TypeScript fully types the IDs without assertions
 * - Processes articles and subjects separately then merges
 *
 * Scalability:
 * - Independent aggregates mean no cross-type contention
 * - Parallel query execution
 * - O(log n) lookups for each aggregate
 * - Separate tables enable maximum write throughput
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
      // Query both aggregates in parallel for this locale
      const [articleCount, subjectCount] = await Promise.all([
        articlePopularity.count(ctx, { namespace: locale }),
        subjectPopularity.count(ctx, { namespace: locale }),
      ]);

      totalProcessed += articleCount + subjectCount;

      // Get top content from both aggregates
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

      // Build a unified list of items to process with proper types
      // Zero assertions - TypeScript knows exact ID types from separate tables
      interface ArticleItem {
        type: "article";
        id: Id<"articleContents">;
        sumValue: number;
      }
      interface SubjectItem {
        type: "subject";
        id: Id<"subjectSections">;
        sumValue: number;
      }
      type QueueItem = ArticleItem | SubjectItem;

      const items: QueueItem[] = [
        ...popularArticles.page.map(
          (item): ArticleItem => ({
            type: "article",
            id: item.key, // TypeScript knows: Id<"articleContents">
            sumValue: item.sumValue,
          })
        ),
        ...popularSubjects.page.map(
          (item): SubjectItem => ({
            type: "subject",
            id: item.key, // TypeScript knows: Id<"subjectSections">
            sumValue: item.sumValue,
          })
        ),
      ];

      // Sort by popularity (descending) to get cross-type popularity
      items.sort((a, b) => b.sumValue - a.sumValue);

      // Process top 100 items (already sorted by popularity)
      for (const item of items.slice(0, 100)) {
        // Minimum view threshold check
        if (item.sumValue < MIN_VIEW_THRESHOLD) {
          continue;
        }

        // Build discriminated contentRef - TypeScript knows exact type
        // Zero assertions needed!
        let contentRef: AudioContentRef;
        if (item.type === "article") {
          contentRef = { type: "article", id: item.id };
        } else {
          contentRef = { type: "subject", id: item.id };
        }

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
          continue;
        }

        // Calculate priority score
        const priorityScore = item.sumValue * 10;

        // Queue with discriminated contentRef
        await ctx.db.insert("audioGenerationQueue", {
          contentRef,
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
