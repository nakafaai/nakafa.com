import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  type AudioQueuePopulationTargets,
  populateAudioGenerationQueue,
} from "@repo/backend/convex/contents/audioQueue/impl";
import {
  type PopulateAudioQueueResult,
  populateAudioQueueResultValidator,
} from "@repo/backend/convex/contents/audioQueue/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

const queueTargets: AudioQueuePopulationTargets = {
  enqueuePopularContent:
    internal.contents.mutations.audio.enqueuePopularContentForAudio,
  readPopularContent:
    internal.contents.queries.audio.getPopularContentForAudioQueue,
};

/**
 * Reads popularity in a query, then enqueues audio work in a separate mutation.
 * This keeps hot popularity reads out of the queue-writing transaction.
 */
export const populateAudioQueue = internalAction({
  args: {},
  returns: populateAudioQueueResultValidator,
  handler: async (ctx): Promise<PopulateAudioQueueResult> =>
    await runConvexProgram(populateAudioGenerationQueue(ctx, queueTargets)),
});
