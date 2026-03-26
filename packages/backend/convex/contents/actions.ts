import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import type { PopularAudioContentItem } from "@repo/backend/convex/contents/helpers/popularity";
import { logger } from "@repo/backend/convex/utils/logger";
import { type Infer, v } from "convex/values";

const populateAudioQueueResultValidator = v.object({
  processed: v.number(),
  queued: v.number(),
});

type PopulateAudioQueueResult = Infer<typeof populateAudioQueueResultValidator>;

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
  handler: async (ctx): Promise<PopulateAudioQueueResult> => {
    logger.info("Populating audio queue started");

    const popularItems: PopularAudioContentItem[] = await ctx.runQuery(
      internal.contents.queries.getPopularContentForAudioQueue,
      {}
    );

    if (popularItems.length === 0) {
      logger.info("No popular content found for audio queue population");
      return { processed: 0, queued: 0 };
    }

    const result: PopulateAudioQueueResult = await ctx.runMutation(
      internal.contents.mutations.enqueuePopularContentForAudio,
      {
        items: popularItems,
      }
    );

    logger.info("Populated audio queue completed", result);

    return result;
  },
});
