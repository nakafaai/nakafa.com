import { query } from "@repo/backend/convex/_generated/server";
import { getAudioPlaybackBySlug } from "@repo/backend/convex/audioStudies/queries/public.impl";
import {
  type AudioPlaybackResult,
  audioPlaybackArgs,
  audioPlaybackResultValidator,
} from "@repo/backend/convex/audioStudies/queries/public.spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/**
 * Gets audio playback URL and metadata by content slug.
 *
 * Public query; no authentication required.
 */
export const getAudioBySlug = query({
  args: audioPlaybackArgs,
  returns: audioPlaybackResultValidator,
  handler: async (ctx, args): Promise<AudioPlaybackResult> =>
    await runConvexProgram(getAudioPlaybackBySlug(ctx, args)),
});
