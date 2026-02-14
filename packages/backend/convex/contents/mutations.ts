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
 *
 * DESIGN: Global Popularity
 * - Popularity is tracked globally (all locales combined)
 * - Popular content gets audio in ALL supported locales
 * - This ensures popular content is accessible in every language
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    // Query GLOBAL popularity (single namespace "global")
    const [articleCount, subjectCount] = await Promise.all([
      articlePopularity.count(ctx, { namespace: "global" }),
      subjectPopularity.count(ctx, { namespace: "global" }),
    ]);

    const totalProcessed = articleCount + subjectCount;
    let totalQueued = 0;

    // Get top content globally (all locales combined)
    const [popularArticles, popularSubjects] = await Promise.all([
      articlePopularity.paginate(ctx, {
        namespace: "global",
        order: "desc",
        pageSize: 100,
      }),
      subjectPopularity.paginate(ctx, {
        namespace: "global",
        order: "desc",
        pageSize: 100,
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

    // Sort by global popularity (descending)
    items.sort((a, b) => b.sumValue - a.sumValue);

    // Take top 100 overall
    const topItems = items.slice(0, 100);

    // Process each popular content
    for (const item of topItems) {
      if (item.sumValue < MIN_VIEW_THRESHOLD) {
        continue;
      }

      // Build discriminated contentRef
      const contentRef =
        item.type === "article"
          ? { type: "article" as const, id: item.id }
          : { type: "subject" as const, id: item.id };

      // Get existing queue entries for this content (all locales)
      const existingEntries = await ctx.db
        .query("audioGenerationQueue")
        .withIndex("contentRef_status", (q) =>
          q
            .eq("contentRef.type", contentRef.type)
            .eq("contentRef.id", contentRef.id)
            .eq("status", "pending")
        )
        .collect();

      // Get content hash for deduplication check
      const contentHash = await ctx.runQuery(
        internal.audioStudies.queries.getContentHash,
        { contentRef }
      );

      // Queue for EACH supported locale
      for (const locale of SUPPORTED_LOCALES) {
        // Check if already queued for this locale
        const existingForLocale = existingEntries.find(
          (e) => e.locale === locale
        );

        // Skip if already in active or terminal state
        if (
          existingForLocale &&
          (existingForLocale.status === "pending" ||
            existingForLocale.status === "processing" ||
            existingForLocale.status === "failed")
        ) {
          continue;
        }

        // Check if up-to-date audio already exists for this locale
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

          // Skip if audio exists, is completed, and hash matches
          if (
            existingAudio?.status === "completed" &&
            existingAudio.contentHash === contentHash
          ) {
            continue;
          }

          // Delete outdated completed entry if exists
          if (existingForLocale) {
            await ctx.db.delete("audioGenerationQueue", existingForLocale._id);
          }
        }

        // Queue for audio generation in this locale
        await ctx.db.insert("audioGenerationQueue", {
          contentRef,
          locale,
          priorityScore: item.sumValue * 10, // Global popularity score
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
 * - Global popularity: Views from ALL locales count toward same content's ranking
 *
 * NOTE: Views are tracked per-locale in the database (for analytics), but the aggregate
 * sums them globally. This allows per-locale analytics while using global popularity
 * for audio prioritization. Popular content gets audio in ALL locales.
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

    // Validate and clamp durationSeconds to non-negative integer
    // Handles clock skew (Date.now() can go backward) and malicious negative values
    const durationSeconds =
      args.durationSeconds !== undefined
        ? Math.max(0, Math.floor(args.durationSeconds))
        : undefined;

    const result = await recordContentViewBySlug(
      ctx,
      args.contentRef.type,
      args.locale,
      args.contentRef.slug,
      {
        deviceId: args.deviceId,
        userId,
        durationSeconds,
      }
    );
    return result;
  },
});
