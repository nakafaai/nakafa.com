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
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";
import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

interface PopularItem {
  ref: AudioContentRef;
  viewCount: number;
}

/**
 * Queues popular content for audio generation across all supported locales.
 * Processes articles and subject sections only (exercises excluded).
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx) => {
    logger.info("Populating audio queue started");

    const [articleCount, subjectCount] = await Promise.all([
      articlePopularity.count(ctx, { namespace: "global" }),
      subjectPopularity.count(ctx, { namespace: "global" }),
    ]);

    const totalCount = articleCount + subjectCount;
    logger.info("Fetched popularity counts", {
      articles: articleCount,
      subjects: subjectCount,
      total: totalCount,
    });

    let totalQueued = 0;

    const [articleResults, subjectResults] = await Promise.all([
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

    const articleItems: PopularItem[] = articleResults.page.map((item) => ({
      ref: { type: "article" as const, id: item.key[1] },
      viewCount: item.sumValue,
    }));

    const subjectItems: PopularItem[] = subjectResults.page.map((item) => ({
      ref: { type: "subject" as const, id: item.key[1] },
      viewCount: item.sumValue,
    }));

    const allItems: PopularItem[] = [...articleItems, ...subjectItems].sort(
      (a, b) => b.viewCount - a.viewCount
    );

    logger.info("Processing popular content", {
      articleItems: articleItems.length,
      subjectItems: subjectItems.length,
      threshold: MIN_VIEW_THRESHOLD,
    });

    for (const item of allItems) {
      if (item.viewCount < MIN_VIEW_THRESHOLD) {
        logger.info("Below threshold, stopping", {
          viewCount: item.viewCount,
          threshold: MIN_VIEW_THRESHOLD,
        });
        break;
      }

      const contentSlug = await ctx.runQuery(
        internal.audioStudies.queries.getContentSlug,
        { contentRef: item.ref }
      );

      if (!contentSlug) {
        logger.warn("Content slug not found", {
          contentType: item.ref.type,
          contentId: item.ref.id,
        });
        continue;
      }

      for (const locale of SUPPORTED_LOCALES) {
        const localeContentRef = await ctx.runQuery(
          internal.audioStudies.queries.getContentRefBySlugAndLocale,
          {
            contentRef: item.ref,
            locale,
          }
        );

        if (!localeContentRef) {
          logger.debug("Locale content not found", {
            contentType: item.ref.type,
            contentId: item.ref.id,
            locale,
          });
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

        if (existingForLocale) {
          if (
            ["pending", "processing", "failed"].includes(
              existingForLocale.status
            )
          ) {
            logger.debug("Already in queue", {
              contentType: localeContentRef.type,
              contentId: localeContentRef.id,
              locale,
              status: existingForLocale.status,
            });
            continue;
          }
          logger.info("Replacing completed queue item", {
            contentType: localeContentRef.type,
            contentId: localeContentRef.id,
            locale,
          });
          await ctx.db.delete("audioGenerationQueue", existingForLocale._id);
        }

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

          if (
            existingAudio?.status === "completed" &&
            existingAudio.contentHash === contentHash
          ) {
            logger.debug("Audio already completed for hash", {
              contentType: localeContentRef.type,
              contentId: localeContentRef.id,
              locale,
            });
            continue;
          }
        }

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

        logger.info("Added to queue", {
          contentType: localeContentRef.type,
          contentId: localeContentRef.id,
          locale,
          priorityScore: item.viewCount * 10,
        });

        totalQueued++;
      }
    }

    logger.info("Populated audio queue completed", {
      processed: totalCount,
      queued: totalQueued,
    });

    return { processed: totalCount, queued: totalQueued };
  },
});

/**
 * Records a unique content view per user/device.
 * Idempotent - returns alreadyViewed=true for duplicate views.
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
