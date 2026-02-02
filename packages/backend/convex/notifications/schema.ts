import { literals } from "@repo/backend/convex/lib/validators";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Notification types - all possible notification triggers in Nakafa
 *
 * Naming convention: {entity}_{action}
 * Extensible: Add new types as features are added
 */
export const notificationTypesValidator = literals(
  // Forum thread related
  "forum_mention",
  "forum_reply",
  "forum_reaction",
  // Forum post related
  "post_mention",
  "post_reply",
  "post_reaction",
  // Comment related (content pages like /subject/...)
  "comment_reply",
  "comment_mention",
  "comment_upvote",
  // Class related
  "class_joined",
  "class_announcement",
  "class_assignment",
  "class_removed",
  // School related
  "school_invite",
  "school_joined",
  "school_role_changed",
  "school_removed",
  // System
  "system"
);
export type NotificationType = Infer<typeof notificationTypesValidator>;

/**
 * Entity types for polymorphic references
 *
 * Generic: Works for any entity type in the app
 * Extensible: Add new types as features are added
 */
export const notificationEntityTypesValidator = literals(
  "schoolClassForums",
  "schoolClassForumPosts",
  "schoolClasses",
  "schools",
  "comments",
  "system"
);
export type NotificationEntityType = Infer<
  typeof notificationEntityTypesValidator
>;

/**
 * Type-safe entity ID union
 *
 * Using v.id() for compile-time validation
 * Extensible: Add new table IDs as features are added
 *
 * NOTE: Keep as v.union(v.id(...)) - these are polymorphic ID references, not string literals
 */
export const notificationEntityIdValidator = v.union(
  v.id("schoolClassForums"),
  v.id("schoolClassForumPosts"),
  v.id("schoolClasses"),
  v.id("schools"),
  v.id("comments")
);
export type NotificationEntityId = Infer<typeof notificationEntityIdValidator>;

/**
 * Email digest frequency options
 *
 * No "realtime" option - too expensive for email (use in-app for realtime)
 * Email is batched to reduce costs (Resend, SendGrid, etc.)
 */
export const emailDigestTypesValidator = literals(
  "daily", // Send digest once per day
  "weekly", // Send digest once per week
  "never" // Don't send email
);
export type EmailDigestType = Infer<typeof emailDigestTypesValidator>;

const tables = {
  /**
   * Main notifications table
   *
   * Design principles (Convex best practices for scale):
   * 1. Generic: Works for ALL entity types (schools, classes, comments, etc.)
   * 2. Minimal fields: No redundant data (isRead derived from readAt)
   * 3. Single index: recipientId only, sorted by _creationTime
   * 4. Type-safe: v.id() unions for compile-time validation
   * 5. Denormalized counts: Separate table for O(1) unread badge
   *
   * Navigation: Build URL at READ TIME by fetching entity
   * - Post → post.forumId → forum.classId → class.schoolId → school.slug
   * - Comment → comment.slug (already contains path)
   * This ensures URLs are always correct even if routing changes.
   *
   * Actor info (name, image) fetched LIVE via actorId (like Twitter)
   * Content preview is SNAPSHOT at creation time
   *
   * Query pattern:
   * .withIndex("recipientId", q => q.eq("recipientId", x))
   * .order("desc")
   * .paginate(opts)
   */
  notifications: defineTable({
    // Who receives this notification
    recipientId: v.id("users"),

    // Who triggered (optional for system notifications)
    actorId: v.optional(v.id("users")),

    // Notification type (determines display text)
    type: notificationTypesValidator,

    // Entity reference (what the notification is about)
    // Navigation URL is built at read time by fetching the entity
    entityType: notificationEntityTypesValidator,
    entityId: v.optional(notificationEntityIdValidator),

    // Read status (null = unread, timestamp = when marked read)
    readAt: v.optional(v.number()),

    // Content preview (snapshot at creation time)
    previewTitle: v.optional(v.string()),
    previewBody: v.optional(v.string()),

    // Note: Use _creationTime for when notification was created
  }).index("recipientId", ["recipientId"]),

  /**
   * Denormalized unread counts for O(1) badge display
   *
   * Updated atomically when notifications are created/read
   * Avoids expensive count queries on every page load
   */
  notificationCounts: defineTable({
    userId: v.id("users"),
    unreadCount: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),

  /**
   * User notification preferences
   *
   * Controls what notifications user receives and delivery method
   * Uses opt-out model (receive all by default, disable specific types)
   *
   * Email digest is batched (daily/weekly) to reduce costs
   * No push notifications (web-only app)
   */
  notificationPreferences: defineTable({
    userId: v.id("users"),

    // Email settings (batched digest only, no realtime - too expensive)
    emailEnabled: v.boolean(),
    emailDigest: emailDigestTypesValidator, // "daily" | "weekly" | "never"

    // Type-level controls (opt-out)
    // e.g., ["post_reaction", "comment_upvote"] - disable noisy notifications
    disabledTypes: v.array(notificationTypesValidator),

    // Entity-level mutes (muted threads, classes, etc.)
    // e.g., mute a specific noisy forum thread
    mutedEntities: v.array(
      v.object({
        entityType: notificationEntityTypesValidator,
        entityId: notificationEntityIdValidator,
        mutedAt: v.number(),
      })
    ),

    updatedAt: v.number(),
  }).index("userId", ["userId"]),
};

export default tables;
