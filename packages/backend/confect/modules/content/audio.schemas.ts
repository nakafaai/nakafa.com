import { GenericId } from "@confect/core";
import { Schema } from "effect";

/**
 * Discriminated union validator for audio content references.
 * Supports articles and subject sections only (exercises excluded).
 */
export const audioContentRefSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("article"),
    id: GenericId.GenericId("articleContents"),
  }),
  Schema.Struct({
    type: Schema.Literal("subject"),
    id: GenericId.GenericId("subjectSections"),
  })
);

export type AudioContentRef = Schema.Schema.Type<typeof audioContentRefSchema>;

/** Audio generation status values. */
export const audioStatusSchema = Schema.Literal(
  "pending",
  "generating-script",
  "script-generated",
  "generating-speech",
  "completed",
  "failed"
);

export type AudioStatus = Schema.Schema.Type<typeof audioStatusSchema>;

/** Supported audio model versions. */
export const audioModelSchema = Schema.Literal("eleven_v3");

export type AudioModel = Schema.Schema.Type<typeof audioModelSchema>;

/** Voice settings for audio generation. */
export const voiceSettingsSchema = Schema.Struct({
  stability: Schema.optional(Schema.Number),
  similarityBoost: Schema.optional(Schema.Number),
  style: Schema.optional(Schema.Number),
  useSpeakerBoost: Schema.optional(Schema.Boolean),
});

export type VoiceSettings = Schema.Schema.Type<typeof voiceSettingsSchema>;
