import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import {
  getContentHash,
  getContentRefBySlugAndLocale,
  getContentSlug,
} from "@repo/backend/convex/audioStudies/utils";
import { popularAudioContentItemValidator } from "@repo/backend/convex/contents/helpers/popularity";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/** Queues popular content for audio generation across all supported locales. */
export const enqueuePopularContentForAudio = internalMutation({
  args: {
    items: v.array(popularAudioContentItemValidator),
  },
  returns: v.object({
    processed: v.number(),
    queued: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.items.length === 0) {
      return { processed: 0, queued: 0 };
    }

    let totalQueued = 0;
    const sortedItems = [...args.items].sort(
      (left, right) => right.viewCount - left.viewCount
    );

    for (const item of sortedItems) {
      if (item.viewCount < MIN_VIEW_THRESHOLD) {
        break;
      }

      const contentSlug = await getContentSlug(ctx, item.ref);

      if (!contentSlug) {
        logger.warn("Content slug not found", {
          contentType: item.ref.type,
          contentId: item.ref.id,
        });
        continue;
      }

      for (const locale of SUPPORTED_LOCALES) {
        const localeContentRef = await getContentRefBySlugAndLocale(
          ctx,
          item.ref,
          locale
        );

        if (!localeContentRef) {
          logger.debug("Locale content not found", {
            contentType: item.ref.type,
            contentId: item.ref.id,
            locale,
          });
          continue;
        }

        const contentHash = await getContentHash(ctx, localeContentRef);
        const existingQueueItem = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
            q
              .eq("contentRef.type", localeContentRef.type)
              .eq("contentRef.id", localeContentRef.id)
              .eq("locale", locale)
          )
          .first();

        if (existingQueueItem) {
          if (
            ["pending", "processing", "failed"].includes(
              existingQueueItem.status
            )
          ) {
            logger.debug("Already in queue", {
              contentType: localeContentRef.type,
              contentId: localeContentRef.id,
              locale,
              status: existingQueueItem.status,
            });
            continue;
          }

          logger.info("Replacing completed queue item", {
            contentType: localeContentRef.type,
            contentId: localeContentRef.id,
            locale,
          });
          await ctx.db.delete("audioGenerationQueue", existingQueueItem._id);
        }

        if (contentHash) {
          const existingAudio = await ctx.db
            .query("contentAudios")
            .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
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

    return { processed: sortedItems.length, queued: totalQueued };
  },
});
