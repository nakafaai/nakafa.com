import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import { v } from "convex/values";

/** Ranked content candidate used when filling the audio generation queue. */
export const popularAudioContentItemValidator = v.object({
  ref: audioContentRefValidator,
  viewCount: v.number(),
});
