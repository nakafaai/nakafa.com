import { internal } from "@repo/backend/convex/_generated/api";
import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import { safeGetAppUser } from "@repo/backend/convex/auth";
import {
  articlePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { recordContentViewBySlug } from "./utils";

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
 *
 * Optimization:
 * - Skips re-queuing content that already has completed audio with matching hash
 * - Prevents unnecessary workflow executions (Convex best practice: avoid unnecessary work)
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
          // Skip if already in active or terminal state
          // Failed items preserve their retryCount - don't reset by re-creating
          // This prevents infinite retry loops on permanently failing content
          if (
            existing.status === "pending" ||
            existing.status === "processing" ||
            existing.status === "failed"
          ) {
            continue;
          }

          // Only handle "completed" items below
          // Optimization: Check if content already has completed audio with matching hash
          // Prevents unnecessary workflow executions (Convex best practice: avoid unnecessary work)
          // Fetches current content hash and existing audio record in parallel for efficiency
          const contentHash = await ctx.runQuery(
            internal.audioStudies.queries.getContentHash,
            { contentRef }
          );

          if (contentHash) {
            const existingAudio = await ctx.db
              .query("contentAudios")
              .withIndex("contentRef_locale", (q) =>
                q
                  .eq("contentRef.type", contentRef.type)
                  .eq("contentRef.id", contentRef.id)
                  .eq("locale", locale)
              )
              .first();

            // Skip re-queuing if audio exists, is completed, and hash matches
            if (
              existingAudio?.status === "completed" &&
              existingAudio.contentHash === contentHash
            ) {
              continue;
            }
          }

          // Only delete completed items that need re-processing (hash mismatch or missing audio)
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

/**
 * Records a content view for popularity tracking.
 *
 * Frontend sends slug + contentType + locale.
 * Backend looks up contentId internally via indexed query.
 *
 * Design:
 * - O(log n) lookup via locale_slug index
 * - Upsert pattern: Creates new or updates existing view record
 * - Deduplication: One record per user+slug or device+slug
 * - Duration tracking: Accumulates total time spent
 *
 * @param contentRef - Discriminated union with type and slug
 * @param locale - Content locale
 * @param deviceId - Anonymous device identifier
 * @param userId - Optional authenticated user
 * @param durationSeconds - Optional time spent viewing
 */
export const recordContentView = mutation({
  args: {
    contentRef: contentViewRefValidator,
    locale: localeValidator,
    deviceId: v.string(),
    durationSeconds: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    isNewView: v.boolean(),
    rateLimited: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user server-side
    const user = await safeGetAppUser(ctx);
    const userId = user?.appUser._id;

    const result = await recordContentViewBySlug(
      ctx,
      args.contentRef.type,
      args.locale,
      args.contentRef.slug,
      {
        deviceId: args.deviceId,
        userId,
        durationSeconds: args.durationSeconds,
      }
    );
    return result;
  },
});
