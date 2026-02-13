import {
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import {
  contentIdValidator,
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const tables = {
  /**
   * Audio content storage for articles, subject sections, and exercises.
   * Shared cache - one audio file per content+voice combination.
   */
  contentAudios: defineTable({
    /** Polymorphic reference to content */
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
    /** ElevenLabs TTS model used for generation */
    model: audioModelValidator,
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
    .index("content_locale", ["contentId", "contentType", "locale"])
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

  /**
   * Audio generation queue for cron-based prioritized processing.
   */
  audioGenerationQueue: defineTable({
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    locale: localeValidator,
    priorityScore: v.number(),
    status: literals("pending", "processing", "completed", "failed"),
    requestedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    retryCount: v.number(),
    maxRetries: v.number(),
    errorMessage: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("status_priority", ["status", "priorityScore"])
    .index("content", ["contentId", "contentType", "locale"])
    .index("status_completedAt", ["status", "completedAt"])
    .index("status_updatedAt", ["status", "updatedAt"]),
};

export default tables;
