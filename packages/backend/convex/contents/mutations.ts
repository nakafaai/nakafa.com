import { internal } from "@repo/backend/convex/_generated/api";
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
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import {
  applyContentAnalyticsBatch,
  buildContentAnalyticsBatch,
  ensureContentAnalyticsPartitionRow,
  hasContentAnalyticsBacklog,
  loadContentAnalyticsQueueBatch,
} from "@repo/backend/convex/contents/helpers/analyticsQueue";
import { isContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import { popularAudioContentItemValidator } from "@repo/backend/convex/contents/helpers/popularity";
import { recordContentViewBySlug } from "@repo/backend/convex/contents/helpers/views";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError, v } from "convex/values";

const contentAnalyticsPartitionResultValidator = v.object({
  hasMore: v.boolean(),
  partition: v.number(),
  processed: v.number(),
  skipped: v.boolean(),
});

const scheduleContentAnalyticsPartitionsResultValidator = v.object({
  scheduledPartitions: v.number(),
});

/**
 * Schedules one worker per idle analytics partition with queued rows.
 *
 * Partition leases prevent duplicate workers from draining the same partition.
 */
export const scheduleContentAnalyticsPartitions = internalMutation({
  args: {},
  returns: scheduleContentAnalyticsPartitionsResultValidator,
  handler: async (ctx) => {
    const now = Date.now();
    let scheduledPartitions = 0;

    for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
      const partitionRow = await ensureContentAnalyticsPartitionRow(
        ctx,
        partition
      );

      const hasBacklog = await hasContentAnalyticsBacklog(ctx, partition);

      if (!hasBacklog) {
        continue;
      }

      if (partitionRow.leaseExpiresAt > now) {
        continue;
      }

      const leaseVersion = partitionRow.leaseVersion + 1;

      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.contents.mutations.processContentAnalyticsPartition,
        {
          leaseVersion,
          partition,
        }
      );

      scheduledPartitions++;
    }

    if (scheduledPartitions > 0) {
      logger.info("Scheduled content analytics partitions", {
        scheduledPartitions,
      });
    }

    return { scheduledPartitions };
  },
});

/**
 * Drains one leased analytics partition into derived popularity tables.
 *
 * Each content reference always hashes to the same partition, so one partition
 * worker owns a content row at a time.
 */
export const processContentAnalyticsPartition = internalMutation({
  args: {
    leaseVersion: v.number(),
    partition: v.number(),
  },
  returns: contentAnalyticsPartitionResultValidator,
  handler: async (ctx, args) => {
    if (!isContentAnalyticsPartition(args.partition)) {
      throw new ConvexError({
        code: "INVALID_CONTENT_ANALYTICS_PARTITION",
        message: "Content analytics partition is out of range.",
      });
    }

    const now = Date.now();
    const partitionRow = await ctx.db
      .query("contentAnalyticsPartitions")
      .withIndex("by_partition", (q) => q.eq("partition", args.partition))
      .unique();

    if (!partitionRow) {
      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: true,
      };
    }

    if (partitionRow.leaseVersion !== args.leaseVersion) {
      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: true,
      };
    }

    if (partitionRow.leaseExpiresAt < now) {
      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: true,
      };
    }

    const queueItems = await loadContentAnalyticsQueueBatch(ctx, {
      batchSize: CONTENT_ANALYTICS_BATCH_SIZE,
      partition: args.partition,
    });

    if (queueItems.length === 0) {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: 0,
      });

      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: false,
      };
    }

    const analyticsBatch = buildContentAnalyticsBatch(queueItems);

    await applyContentAnalyticsBatch(ctx, analyticsBatch);

    for (const queueItem of queueItems) {
      await ctx.db.delete("contentViewAnalyticsQueue", queueItem._id);
    }

    const hasMore = queueItems.length === CONTENT_ANALYTICS_BATCH_SIZE;

    if (hasMore) {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.contents.mutations.processContentAnalyticsPartition,
        args
      );
    } else {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: 0,
      });
    }

    logger.info("Processed content analytics partition batch", {
      hasMore,
      partition: args.partition,
      processed: queueItems.length,
    });

    return {
      hasMore,
      partition: args.partition,
      processed: queueItems.length,
      skipped: false,
    };
  },
});

/**
 * Queues popular content for audio generation across all supported locales.
 *
 * The caller supplies already-ranked items so this mutation does not read from
 * hot popularity tables.
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

        const existingForLocale = await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
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
    const user = await getOptionalAppUser(ctx);

    return recordContentViewBySlug(ctx, {
      deviceId: args.deviceId,
      locale: args.locale,
      slug: args.contentRef.slug,
      type: args.contentRef.type,
      userId: user?.appUser._id,
    });
  },
});
