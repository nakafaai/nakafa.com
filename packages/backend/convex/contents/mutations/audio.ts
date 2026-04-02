import {
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import {
  getAudioContentLookup,
  getLocalizedAudioContentLookup,
} from "@repo/backend/convex/audioStudies/utils";
import { popularAudioContentItemValidator } from "@repo/backend/convex/contents/validators";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/**
 * Queues locale-specific audio work from already-ranked popularity items.
 */
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

      const sourceContent = await getAudioContentLookup(ctx, item.ref);

      if (!sourceContent) {
        logger.warn("Content slug not found", {
          contentType: item.ref.type,
          contentId: item.ref.id,
        });
        continue;
      }

      for (const locale of SUPPORTED_LOCALES) {
        const localizedContent = await getLocalizedAudioContentLookup(
          ctx,
          sourceContent,
          locale
        );

        if (!localizedContent) {
          logger.debug("Locale content not found", {
            contentType: item.ref.type,
            contentId: item.ref.id,
            locale,
          });
          continue;
        }

        const existingQueueItem = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
            q
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
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
              contentType: localizedContent.ref.type,
              contentId: localizedContent.ref.id,
              locale,
              status: existingQueueItem.status,
            });
            continue;
          }

          logger.info("Replacing completed queue item", {
            contentType: localizedContent.ref.type,
            contentId: localizedContent.ref.id,
            locale,
          });
          await ctx.db.delete("audioGenerationQueue", existingQueueItem._id);
        }

        const existingAudio = await ctx.db
          .query("contentAudios")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
            q
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
              .eq("locale", locale)
          )
          .first();

        if (
          existingAudio?.status === "completed" &&
          existingAudio.contentHash === localizedContent.contentHash
        ) {
          logger.debug("Audio already completed for hash", {
            contentType: localizedContent.ref.type,
            contentId: localizedContent.ref.id,
            locale,
          });
          continue;
        }

        await ctx.db.insert("audioGenerationQueue", {
          contentRef: localizedContent.ref,
          locale,
          slug: sourceContent.slug,
          priorityScore: item.viewCount * 10,
          status: "pending",
          requestedAt: Date.now(),
          retryCount: 0,
          maxRetries: RETRY_CONFIG.maxRetries,
          updatedAt: Date.now(),
        });

        logger.info("Added to queue", {
          contentType: localizedContent.ref.type,
          contentId: localizedContent.ref.id,
          locale,
          priorityScore: item.viewCount * 10,
        });

        totalQueued++;
      }
    }

    return { processed: sortedItems.length, queued: totalQueued };
  },
});
