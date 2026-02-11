import {
  audioStatusValidator,
  localeValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Validator for content ID - polymorphic reference to article or subject section.
 */
export const contentIdValidator = v.union(
  v.id("articleContents"),
  v.id("subjectSections")
);

/**
 * Validator for content type discriminator.
 */
export const contentTypeValidator = literals("article", "subject");

/**
 * Type for content ID.
 */
export type ContentId = Infer<typeof contentIdValidator>;

/**
 * Type for content type.
 */
export type ContentType = Infer<typeof contentTypeValidator>;

const tables = {
  /**
   * Audio content storage for articles and subject sections.
   * Shared cache - one audio file per content+voice combination.
   */
  contentAudios: defineTable({
    /** Polymorphic reference to article or subject section */
    contentId: contentIdValidator,
    /** Discriminator for content type */
    contentType: contentTypeValidator,
    locale: localeValidator,
    /** SHA-256 hash of content body for cache invalidation */
    contentHash: v.string(),
    /** ElevenLabs voice ID */
    voiceId: v.string(),
    /** Voice settings stored per audio for future customization */
    voiceSettings: v.optional(voiceSettingsValidator),
    status: audioStatusValidator,
    /** Generated podcast script with ElevenLabs v3 tags */
    script: v.optional(v.string()),
    /** Convex storage ID for the generated audio file */
    audioStorageId: v.optional(v.id("_storage")),
    /** Audio duration in seconds */
    audioDuration: v.optional(v.number()),
    /** Audio file size in bytes */
    audioSize: v.optional(v.number()),
    /** Error message if generation failed */
    errorMessage: v.optional(v.string()),
    /** Timestamp when generation failed */
    failedAt: v.optional(v.number()),
    /** Number of generation attempts (for retry logic) */
    generationAttempts: v.number(),
    /** Last update timestamp */
    updatedAt: v.number(),
  })
    .index("content_voice", ["contentId", "contentType", "voiceId"])
    .index("content", ["contentId", "contentType"])
    .index("status", ["status"]),

  /**
   * User listening history and access tracking.
   * Tracks which users have accessed which audio content.
   */
  userContentAudios: defineTable({
    userId: v.id("users"),
    contentAudioId: v.id("contentAudios"),
    /** Denormalized for efficient history queries */
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    playCount: v.number(),
    lastPlayedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("user", ["userId"])
    .index("user_content", ["userId", "contentId", "contentType"])
    .index("contentAudio", ["contentAudioId"]),
};

export default tables;
