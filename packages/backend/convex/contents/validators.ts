import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";

const audioContentLookupValidator = v.object({
  contentHash: v.string(),
  locale: localeValidator,
  ref: audioContentRefValidator,
  slug: v.string(),
});

export type AudioContentLookup = Infer<typeof audioContentLookupValidator>;

/** Ranked content candidate used when filling the audio generation queue. */
export const popularAudioContentItemValidator = v.object({
  ref: audioContentRefValidator,
  sourceContent: v.optional(audioContentLookupValidator),
  viewCount: v.number(),
});

export type PopularAudioContentItem = Infer<
  typeof popularAudioContentItemValidator
>;
