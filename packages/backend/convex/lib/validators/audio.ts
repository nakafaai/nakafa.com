import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Discriminated union validator for audio content references.
 * Supports articles and subject sections only (exercises excluded).
 */
export const audioContentRefValidator = v.union(
  v.object({
    type: v.literal("article"),
    id: v.id("articleContents"),
  }),
  v.object({
    type: v.literal("subject"),
    id: v.id("subjectSections"),
  })
);

export type AudioContentRef = Infer<typeof audioContentRefValidator>;

/** Audio generation status values. */
export const audioStatusValidator = literals(
  "pending",
  "generating-script",
  "script-generated",
  "generating-speech",
  "completed",
  "failed"
);
export type AudioStatus = Infer<typeof audioStatusValidator>;

/** Supported audio model versions. */
export const audioModelValidator = literals("eleven_v3");
export type AudioModel = Infer<typeof audioModelValidator>;

/** Voice settings for audio generation. */
export const voiceSettingsValidator = v.object({
  stability: v.optional(v.number()),
  similarityBoost: v.optional(v.number()),
  style: v.optional(v.number()),
  useSpeakerBoost: v.optional(v.boolean()),
});
export type VoiceSettings = Infer<typeof voiceSettingsValidator>;
