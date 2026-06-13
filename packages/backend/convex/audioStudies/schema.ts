import { audioContentIdentityFields } from "@repo/backend/convex/audioStudies/content/spec";
import {
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const tables = {
  /**
   * Compact audio source metadata for queue population.
   * Avoids reading large article/subject body documents in cron queries.
   */
  audioContentSources: defineTable({
    ...audioContentIdentityFields,
    contentHash: v.string(),
    syncedAt: v.number(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_contentType_and_route_and_locale", [
      "contentType",
      "route",
      "locale",
    ]),

  /** Audio files keyed by graph content identity for articles and subjects. */
  contentAudios: defineTable({
    ...audioContentIdentityFields,
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
    /** Audio duration in milliseconds (integer) for maximum precision */
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
    /**
     * Primary lookup by graph content ID and locale.
     * Used to check if audio already exists for specific content.
     * Also covers cross-locale queries via prefix (per Convex best practices).
     */
    .index("by_content_id", ["content_id"])
    .index("by_content_id_and_locale", ["content_id", "locale"])
    /** Bounded cleanup for incomplete audio records. */
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  /** Queue for audio generation jobs keyed by graph content identity. */
  audioGenerationQueue: defineTable({
    ...audioContentIdentityFields,
    /**
     * Priority score for queue ordering.
     * Calculated from: viewCount × 10 + ageBoost
     * Higher score = higher priority
     */
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
    /**
     * Primary queue processing index.
     * Fetches pending items ordered by priority (descending).
     */
    .index("by_status_and_priorityScore", ["status", "priorityScore"])
    /**
     * Deduplication check.
     * Ensures content isn't queued multiple times per locale.
     */
    .index("by_content_id", ["content_id"])
    .index("by_content_id_and_locale", ["content_id", "locale"])
    /**
     * Content + status queries by route (cross-locale).
     * Finds all pending items for a content across ALL locales.
     * This enables processing all translations together as one content piece.
     * Per Convex best practices: use specific index ranges for O(log n) performance.
     */
    .index("by_route_and_status", ["route", "status"])
    /**
     * Cleanup queries.
     * Removes old completed/failed items.
     */
    .index("by_status_and_completedAt", ["status", "completedAt"])
    /**
     * Error tracking.
     * Finds items with recent errors for retry.
     */
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),
};

export default tables;
