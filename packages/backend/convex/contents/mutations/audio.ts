import { enqueuePopularAudioContent } from "@repo/backend/convex/contents/audioQueue/impl";
import {
  type EnqueuePopularContentForAudioResult,
  enqueuePopularContentForAudioArgs,
  enqueuePopularContentForAudioResultValidator,
} from "@repo/backend/convex/contents/audioQueue/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/**
 * Queues locale-specific audio work from already-ranked popularity items.
 */
export const enqueuePopularContentForAudio = internalMutation({
  args: enqueuePopularContentForAudioArgs,
  returns: enqueuePopularContentForAudioResultValidator,
  handler: async (ctx, args): Promise<EnqueuePopularContentForAudioResult> =>
    await runConvexProgram(enqueuePopularAudioContent(ctx, args)),
});
