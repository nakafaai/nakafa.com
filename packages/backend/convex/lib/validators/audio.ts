import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Content types supported for audio generation.
 * Note: "exercise" is excluded - exercises don't generate audio.
 * For statistics tracking, all types including exercise are used.
 */
export const audioContentTypeValidator = literals("article", "subject");
export type AudioContentType = Infer<typeof audioContentTypeValidator>;

/**
 * Discriminated union for audio content references.
 *
 * Design benefits:
 * - TypeScript automatically narrows the id type based on the type discriminator
 * - Zero type assertions needed anywhere in the codebase
 * - Self-documenting: the relationship between type and id is explicit
 * - Matches Convex best practices for polymorphic references
 * - Single table stores all audio content types efficiently
 *
 * Usage with switch statement (zero assertions):
 * ```typescript
 * switch (contentRef.type) {
 *   case "article": {
 *     // contentRef.id is automatically typed as Id<"articleContents">
 *     const article = await ctx.db.get("articleContents", contentRef.id);
 *   }
 * }
 * ```
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

/**
 * Type for audio content reference discriminated union.
 * Use this type for function parameters and return types.
 */
export type AudioContentRef = Infer<typeof audioContentRefValidator>;

/**
 * Helper interface for article content references.
 * Useful when you need the specific type in function signatures.
 */
export interface ArticleContentRef {
  type: "article";
  id: Id<"articleContents">;
}

/**
 * Helper interface for subject content references.
 * Useful when you need the specific type in function signatures.
 */
export interface SubjectContentRef {
  type: "subject";
  id: Id<"subjectSections">;
}

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
