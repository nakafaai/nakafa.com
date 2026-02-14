import {
  audioContentRefValidator,
  audioModelValidator,
  audioStatusValidator,
  voiceSettingsValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const tables = {
  /**
   * Unified audio storage for articles and subject sections.
   *
   * Design:
   * - Uses discriminated union for type-safe content references
   * - TypeScript automatically narrows id type based on discriminator
   * - Zero type assertions needed in application code
   * - Single table enables efficient cross-type queries (e.g., "all pending audio")
   *
   * Scalability:
   * - One table = one set of indexes = O(log n) lookups
   * - Easy to add new content types (extend the union)
   * - Convex handles horizontal scaling automatically
   *
   * Note: Exercises are excluded - they don't generate audio.
   */
  contentAudios: defineTable({
    /**
     * Discriminated content reference.
     * { type: "article", id: Id<"articleContents"> } |
     * { type: "subject", id: Id<"subjectSections"> }
     *
     * Benefits:
     * - Type-safe: TypeScript knows exact id type in each branch
     * - Self-documenting: relationship between type and id is explicit
     * - No assertions: switch statement narrowing works automatically
     */
    contentRef: audioContentRefValidator,
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
    /**
     * Primary lookup by content reference and locale.
     * Used to check if audio already exists for specific content.
     */
    .index("contentRef_locale", ["contentRef.type", "contentRef.id", "locale"])
    /**
     * Lookup by content type and id (without locale).
     * Used for cross-locale queries.
     */
    .index("contentRef", ["contentRef.type", "contentRef.id"]),

  /**
   * Unified audio generation queue for cron-based prioritized processing.
   *
   * Design:
   * - Single queue table handles all content types
   * - Enables cross-type prioritization (e.g., most popular article vs subject)
   * - Uses discriminated contentRef for type safety
   *
   * Processing:
   * 1. Query by status_priority to get pending items
   * 2. Lock item by updating status to "processing"
   * 3. Generate audio via workflow
   * 4. Mark as completed or failed
   *
   * Note: Exercises are excluded - they don't generate audio.
   */
  audioGenerationQueue: defineTable({
    contentRef: audioContentRefValidator,
    locale: localeValidator,
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
    .index("status_priority", ["status", "priorityScore"])
    /**
     * Deduplication check.
     * Ensures content isn't queued multiple times.
     */
    .index("contentRef_locale", ["contentRef.type", "contentRef.id", "locale"])
    /**
     * Cleanup queries.
     * Removes old completed/failed items.
     */
    .index("status_completedAt", ["status", "completedAt"])
    /**
     * Error tracking.
     * Finds items with recent errors for retry.
     */
    .index("status_updatedAt", ["status", "updatedAt"]),
};

export default tables;
