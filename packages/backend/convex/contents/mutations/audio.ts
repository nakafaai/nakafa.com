import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
  SUPPORTED_LOCALES,
} from "@repo/backend/convex/audioStudies/constants";
import {
  fetchContentHash,
  getContentRefBySlugAndLocale,
  getContentSlug,
} from "@repo/backend/convex/audioStudies/utils";
import {
  mergePopularAudioContentItems,
  type PopularAudioContentItem,
} from "@repo/backend/convex/contents/helpers/popularity";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

const populateAudioQueueResultValidator = v.object({
  processed: v.number(),
  queued: v.number(),
});

/**
 * Reads current popularity rankings, then queues locale-specific audio work.
 *
 * This job runs on a cron, so it does not sit on the user-facing content view
 * write path.
 */
export const populateAudioQueue = internalMutation({
  args: {},
  returns: populateAudioQueueResultValidator,
  handler: async (ctx) => {
    logger.info("Populating audio queue started");

    const [articleRows, subjectRows] = await Promise.all([
      ctx.db
        .query("articlePopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
      ctx.db
        .query("subjectPopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
    ]);

    const items = mergePopularAudioContentItems([
      ...articleRows.map(
        (row) =>
          ({
            ref: { type: "article", id: row.contentId },
            viewCount: row.viewCount,
          }) satisfies PopularAudioContentItem
      ),
      ...subjectRows.map(
        (row) =>
          ({
            ref: { type: "subject", id: row.contentId },
            viewCount: row.viewCount,
          }) satisfies PopularAudioContentItem
      ),
    ]);

    if (items.length === 0) {
      logger.info("No popular content found for audio queue population");
      return { processed: 0, queued: 0 };
    }

    let totalQueued = 0;
    const sortedItems = [...items].sort(
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

        const contentHash = await fetchContentHash(ctx, localeContentRef);
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

    const result = { processed: sortedItems.length, queued: totalQueued };

    logger.info("Populated audio queue completed", result);

    return result;
  },
});
