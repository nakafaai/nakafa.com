import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/**
 * Reads popularity in a query, then enqueues audio work in a separate mutation.
 * This keeps hot popularity reads out of the queue-writing transaction.
 */
export const populateAudioQueue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    logger.info("Populating audio queue started");

    const items = await ctx.runQuery(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    if (items.length === 0) {
      logger.info("No popular content found for audio queue population");
      return null;
    }

    const result = await ctx.runMutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items,
      }
    );

    logger.info("Populated audio queue completed", result);

    return null;
  },
});
