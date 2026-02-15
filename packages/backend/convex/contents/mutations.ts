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
import { recordContentViewBySlug } from "@repo/backend/convex/contents/utils";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

/**
 * Queues popular content for audio generation. Runs every 30 minutes via cron.
 *
 * When content is popular in ANY locale, it gets audio in ALL locales.
 *
 * Note: Uses aggregate.count() to count unique views (each record = 1 view).
 * Per Convex best practices, we count records rather than summing redundant fields.
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    // Get total counts using aggregate.count() - counts records, not sum of fields
    const [articleCount, subjectCount] = await Promise.all([
      articlePopularity.count(ctx, { namespace: "global" }),
      subjectPopularity.count(ctx, { namespace: "global" }),
    ]);

    const totalProcessed = articleCount + subjectCount;
    let totalQueued = 0;

    // Paginate to get most viewed content
    // Results ordered by insertion order in aggregate (sorted by contentId)
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

    // Build popularity map by counting views per contentId
    // Since each record is 1 unique view, we count how many records per contentId
    const contentViewCounts = new Map<string, number>();

    for (const item of popularArticles.page) {
      const contentId = item.key[1];
      const key = `article:${contentId}`;
      contentViewCounts.set(key, (contentViewCounts.get(key) || 0) + 1);
    }

    for (const item of popularSubjects.page) {
      const contentId = item.key[1];
      const key = `subject:${contentId}`;
      contentViewCounts.set(key, (contentViewCounts.get(key) || 0) + 1);
    }

    // Convert to array and sort by view count (descending)
    const items = [
      ...popularArticles.page.map((item) => ({
        type: "article" as const,
        id: item.key[1],
        viewCount: contentViewCounts.get(`article:${item.key[1]}`) || 0,
      })),
      ...popularSubjects.page.map((item) => ({
        type: "subject" as const,
        id: item.key[1],
        viewCount: contentViewCounts.get(`subject:${item.key[1]}`) || 0,
      })),
    ];

    // Sort by view count (popularity) descending
    items.sort((a, b) => b.viewCount - a.viewCount);
    const topItems = items.slice(0, 100);

    for (const item of topItems) {
      // Skip if below minimum view threshold
      if (item.viewCount < MIN_VIEW_THRESHOLD) {
        break; // Remaining items also below threshold (sorted descending)
      }

      const popularContentRef =
        item.type === "article"
          ? { type: "article" as const, id: item.id }
          : { type: "subject" as const, id: item.id };

      const contentSlug = await ctx.runQuery(
        internal.audioStudies.queries.getContentSlug,
        { contentRef: popularContentRef }
      );

      if (!contentSlug) {
        continue;
      }

      // Queue all locale versions using same slug
      for (const locale of SUPPORTED_LOCALES) {
        const localeContentRef = await ctx.runQuery(
          internal.audioStudies.queries.getContentRefBySlugAndLocale,
          {
            contentRef: popularContentRef,
            locale,
          }
        );

        if (!localeContentRef) {
          continue;
        }

        const contentHash = await ctx.runQuery(
          internal.audioStudies.queries.getContentHash,
          { contentRef: localeContentRef }
        );

        const existingForLocale = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("contentRef_locale", (q) =>
            q
              .eq("contentRef.type", localeContentRef.type)
              .eq("contentRef.id", localeContentRef.id)
              .eq("locale", locale)
          )
          .first();

        // Check existing queue item - don't interrupt active workflows
        if (existingForLocale) {
          // Skip if item is pending, processing, or failed
          // Deleting these would interrupt work or reset retry counts
          if (
            ["pending", "processing", "failed"].includes(
              existingForLocale.status
            )
          ) {
            continue;
          }
          // Delete completed (stale) items only
          await ctx.db.delete("audioGenerationQueue", existingForLocale._id);
        }

        // Check if up-to-date audio already exists
        if (contentHash) {
          const existingAudio = await ctx.db
            .query("contentAudios")
            .withIndex("contentRef_locale", (q) =>
              q
                .eq("contentRef.type", localeContentRef.type)
                .eq("contentRef.id", localeContentRef.id)
                .eq("locale", locale)
            )
            .first();

          // Skip if audio exists, is completed, AND hash matches
          if (
            existingAudio?.status === "completed" &&
            existingAudio.contentHash === contentHash
          ) {
            continue;
          }
        }

        // Priority based on view count (popularity)
        await ctx.db.insert("audioGenerationQueue", {
          contentRef: localeContentRef,
          locale,
          slug: contentSlug,
          priorityScore: item.viewCount * 10,
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
 * Records a unique content view per user/device per content.
 *
 * Idempotent: Same user/device viewing same content multiple times
 * will only count as 1 view. Returns alreadyViewed=true if previously viewed.
 */
export const recordContentView = mutation({
  args: {
    contentRef: contentViewRefValidator,
    locale: localeValidator,
    deviceId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    isNewView: v.boolean(),
    alreadyViewed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    const userId = user?.appUser._id;

    return await recordContentViewBySlug(
      ctx,
      args.contentRef.type,
      args.locale,
      args.contentRef.slug,
      {
        deviceId: args.deviceId,
        userId,
      }
    );
  },
});
