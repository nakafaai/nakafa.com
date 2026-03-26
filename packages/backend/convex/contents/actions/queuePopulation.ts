import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

const populateAudioQueueResultValidator = v.object({
  processed: v.number(),
  queued: v.number(),
});

/**
 * Reads current popularity rankings, then syncs the audio generation queue.
 *
 * This stays in an action so the popularity read and queue writes run in
 * separate transactions. That keeps audio queue population off the hot
 * popularity write path.
 */
export const populateAudioQueue = internalAction({
  args: {},
  returns: populateAudioQueueResultValidator,
  handler: async (ctx) => {
    logger.info("Populating audio queue started");

    const popularItems = await ctx.runQuery(
      internal.contents.queries.audioQueue.getPopularContentForAudioQueue,
      {}
    );

    if (popularItems.length === 0) {
      logger.info("No popular content found for audio queue population");
      return { processed: 0, queued: 0 };
    }

    const enqueueResult = await ctx.runMutation(
      internal.contents.mutations.audioQueue.enqueuePopularContentForAudio,
      {
        items: popularItems,
      }
    );

    const result = {
      processed: enqueueResult.processed,
      queued: enqueueResult.queued,
    };

    logger.info("Populated audio queue completed", result);

    return result;
  },
});
