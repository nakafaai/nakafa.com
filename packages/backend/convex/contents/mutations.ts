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
 * Per-locale popularity tracking enables language-specific trending analytics.
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    const [articleCount, subjectCount] = await Promise.all([
      articlePopularity.count(ctx, { namespace: "global" }),
      subjectPopularity.count(ctx, { namespace: "global" }),
    ]);

    const totalProcessed = articleCount + subjectCount;
    let totalQueued = 0;

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

    // Extract contentId from [viewCount, contentId] composite key
    const items = [
      ...popularArticles.page.map((item) => ({
        type: "article" as const,
        id: item.key[1],
        sumValue: item.sumValue,
      })),
      ...popularSubjects.page.map((item) => ({
        type: "subject" as const,
        id: item.key[1],
        sumValue: item.sumValue,
      })),
    ];

    items.sort((a, b) => b.sumValue - a.sumValue);
    const topItems = items.slice(0, 100);

    for (const item of topItems) {
      if (item.sumValue < MIN_VIEW_THRESHOLD) {
        break; // Remaining items also below threshold
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

        // Check if up-to-date audio already exists
        let shouldSkip = false;
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

          // Skip only if audio exists, is completed, AND hash matches
          if (
            existingAudio?.status === "completed" &&
            existingAudio.contentHash === contentHash
          ) {
            shouldSkip = true;
          }
        }

        // Clean up stale queue entry if exists (regardless of contentHash)
        // This prevents orphaned queue items when contentHash is null
        if (existingForLocale) {
          await ctx.db.delete("audioGenerationQueue", existingForLocale._id);
        }

        // Skip queuing if up-to-date audio exists
        if (shouldSkip) {
          continue;
        }

        await ctx.db.insert("audioGenerationQueue", {
          contentRef: localeContentRef,
          locale,
          slug: contentSlug,
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
 * Rate-limited per device/user per content (60 second window).
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
    const user = await safeGetAppUser(ctx);
    const userId = user?.appUser._id;

    // Clamp duration to non-negative integer (handles clock skew)
    const durationSeconds =
      args.durationSeconds !== undefined
        ? Math.max(0, Math.floor(args.durationSeconds))
        : undefined;

    return await recordContentViewBySlug(
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
  },
});
