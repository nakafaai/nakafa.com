import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Audio generation status for contentAudios - uses kebab-case convention */
export const audioStatusValidator = literals(
  "pending",
  "generating-script",
  "script-generated",
  "generating-speech",
  "completed",
  "failed"
);
export type AudioStatus = Infer<typeof audioStatusValidator>;

/** ElevenLabs TTS model versions */
export const audioModelValidator = literals("eleven_v3");
export type AudioModel = Infer<typeof audioModelValidator>;

/** Voice settings for ElevenLabs V3 model
 * Stores all voice customization parameters.
 * Note: V3 has a 5,000 character limit per request - long scripts are automatically chunked.
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */
export const voiceSettingsValidator = v.object({
  stability: v.optional(v.number()),
  similarityBoost: v.optional(v.number()),
  style: v.optional(v.number()),
  useSpeakerBoost: v.optional(v.boolean()),
});
export type VoiceSettings = Infer<typeof voiceSettingsValidator>;
