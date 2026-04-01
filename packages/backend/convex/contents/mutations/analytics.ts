import {
  CONTENT_VIEW_EVENT_BATCH_SIZE,
  CONTENT_VIEW_EVENT_SEGMENT_MS,
} from "@repo/backend/convex/contents/constants";
import { getContentViewEventSegmentStart } from "@repo/backend/convex/contents/helpers/events";
import { upsertContentViewFromEvent } from "@repo/backend/convex/contents/helpers/views";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/helpers/writes";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/** Drains one bounded batch of sealed content view events. */
export const drainContentViewEvents = internalMutation({
  args: {},
  returns: v.object({
    hasMore: v.boolean(),
    newViews: v.number(),
    processed: v.number(),
  }),
  handler: async (ctx) => {
    const currentSegmentStart = getContentViewEventSegmentStart(Date.now());
    const sealedBeforeSegmentStart =
      currentSegmentStart - CONTENT_VIEW_EVENT_SEGMENT_MS;

    if (sealedBeforeSegmentStart <= 0) {
      return {
        hasMore: false,
        newViews: 0,
        processed: 0,
      };
    }

    const events = await ctx.db
      .query("contentViewEvents")
      .withIndex("by_segmentStart", (q) =>
        q.lt("segmentStart", sealedBeforeSegmentStart)
      )
      .take(CONTENT_VIEW_EVENT_BATCH_SIZE);

    if (events.length === 0) {
      return {
        hasMore: false,
        newViews: 0,
        processed: 0,
      };
    }

    const newViewEvents = events.slice(0, 0).map((event) => ({
      contentRef: event.contentRef,
      locale: event.locale,
      viewedAt: event.viewedAt,
    }));

    for (const event of events) {
      const result = await upsertContentViewFromEvent(ctx.db, {
        contentRef: event.contentRef,
        deviceId: event.deviceId,
        locale: event.locale,
        slug: event.slug,
        userId: event.userId,
        viewedAt: event.viewedAt,
      });

      if (result.isNewView) {
        newViewEvents.push({
          contentRef: event.contentRef,
          locale: event.locale,
          viewedAt: event.viewedAt,
        });
      }
    }

    if (newViewEvents.length > 0) {
      await applyContentAnalyticsBatch(ctx, newViewEvents);
    }

    for (const event of events) {
      await ctx.db.delete("contentViewEvents", event._id);
    }

    const hasMore = events.length === CONTENT_VIEW_EVENT_BATCH_SIZE;

    logger.info("Drained sealed content view events", {
      hasMore,
      newViews: newViewEvents.length,
      processed: events.length,
    });

    return {
      hasMore,
      newViews: newViewEvents.length,
      processed: events.length,
    };
  },
});
