import {
  audioStatusValidator,
  localeValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

const tables = {
  /**
   * Audio content storage for articles and subject sections.
   * Shared cache - one audio file per content+voice combination.
   */
  contentAudios: defineTable({
    /** Polymorphic reference to article or subject section */
    contentId: v.union(v.id("articleContents"), v.id("subjectSections")),
    /** Discriminator for content type */
    contentType: literals("article", "subject"),
    locale: localeValidator,
    /** SHA-256 hash of content body for cache invalidation */
    contentHash: v.string(),
    /** ElevenLabs voice ID */
    voiceId: v.string(),
    /** Voice settings stored per audio for future customization */
    voiceSettings: nullable(voiceSettingsValidator),
    status: audioStatusValidator,
    /** Generated podcast script with ElevenLabs v3 tags */
    script: nullable(v.string()),
    /** Convex storage ID for the generated audio file */
    audioStorageId: nullable(v.id("_storage")),
    /** Audio duration in seconds */
    audioDuration: nullable(v.number()),
    /** Audio file size in bytes */
    audioSize: nullable(v.number()),
    /** Error message if generation failed */
    errorMessage: nullable(v.string()),
    /** Timestamp when generation failed */
    failedAt: nullable(v.number()),
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
    contentId: v.union(v.id("articleContents"), v.id("subjectSections")),
    contentType: literals("article", "subject"),
    playCount: v.number(),
    lastPlayedAt: nullable(v.number()),
    updatedAt: v.number(),
  })
    .index("user", ["userId"])
    .index("user_content", ["userId", "contentId", "contentType"])
    .index("contentAudio", ["contentAudioId"]),
};

export default tables;
