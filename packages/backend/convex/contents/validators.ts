import { audioContentIdentityFields } from "@repo/backend/convex/audioStudies/content/spec";
import { type Infer, v } from "convex/values";

export const audioContentLookupValidator = v.object({
  ...audioContentIdentityFields,
  contentHash: v.string(),
});

export type AudioContentLookup = Infer<typeof audioContentLookupValidator>;

/** Ranked content candidate used when filling the audio generation queue. */
export const popularAudioContentItemValidator = v.object({
  sourceContent: audioContentLookupValidator,
  viewCount: v.number(),
});

export type PopularAudioContentItem = Infer<
  typeof popularAudioContentItemValidator
>;
