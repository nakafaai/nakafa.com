import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

/**
 * Notification types - all possible notification triggers in Nakafa
 *
 * Naming convention: {entity}_{action}
 * Extensible: Add new types as features are added
 */
export const notificationTypesSchema = Schema.Literal(
  "forum_mention",
  "forum_reply",
  "forum_reaction",
  "post_mention",
  "post_reply",
  "post_reaction",
  "comment_reply",
  "comment_mention",
  "comment_upvote",
  "class_joined",
  "class_announcement",
  "class_assignment",
  "class_removed",
  "school_invite",
  "school_joined",
  "school_role_changed",
  "school_removed",
  "system"
);

/**
 * Entity types for polymorphic references
 *
 * Generic: Works for every supported entity type in the app
 * Extensible: Add new types as features are added
 */
export const notificationEntityTypesSchema = Schema.Literal(
  "schoolClassForums",
  "schoolClassForumPosts",
  "schoolClasses",
  "schools",
  "comments",
  "system"
);

/**
 * Type-safe entity ID union
 *
 * Uses Confect generic IDs so every notification target stays tied to its table.
 * Extensible: Add new table IDs as features are added
 */
export const notificationEntityIdSchema = Schema.Union(
  GenericId.GenericId("schoolClassForums"),
  GenericId.GenericId("schoolClassForumPosts"),
  GenericId.GenericId("schoolClasses"),
  GenericId.GenericId("schools"),
  GenericId.GenericId("comments")
);

/**
 * Email digest frequency options
 *
 * No "realtime" option - too expensive for email (use in-app for realtime)
 * Email is batched to reduce costs (Resend, SendGrid, etc.)
 */
export const emailDigestTypesSchema = Schema.Literal(
  "daily",
  "weekly",
  "never"
);

export const notificationMutedEntitySchema = Schema.Struct({
  entityType: notificationEntityTypesSchema,
  entityId: notificationEntityIdSchema,
  mutedAt: Schema.Number,
});

export const notificationPreferenceSettingsSchema = Schema.Struct({
  emailEnabled: Schema.Boolean,
  emailDigest: emailDigestTypesSchema,
  disabledTypes: Schema.Array(notificationTypesSchema),
});

/** notifications table definition. */
export const Notifications = Table.make(
  "notifications",
  Schema.Struct({
    recipientId: GenericId.GenericId("users"),
    actorId: Schema.optional(GenericId.GenericId("users")),
    type: notificationTypesSchema,
    entityType: notificationEntityTypesSchema,
    entityId: Schema.optional(notificationEntityIdSchema),
    readAt: Schema.optional(Schema.Number),
    previewTitle: Schema.optional(Schema.String),
    previewBody: Schema.optional(Schema.String),
  })
)
  .index("by_recipientId", ["recipientId"])
  .index("by_actorId", ["actorId"])
  .index("by_entityType_and_entityId", ["entityType", "entityId"]);

/** notificationCounts table definition. */
export const NotificationCounts = Table.make(
  "notificationCounts",
  Schema.Struct({
    userId: GenericId.GenericId("users"),
    unreadCount: Schema.Number,
    updatedAt: Schema.Number,
  })
).index("by_userId", ["userId"]);

/** notificationPreferences table definition. */
export const NotificationPreferences = Table.make(
  "notificationPreferences",
  Schema.Struct({
    userId: GenericId.GenericId("users"),
    disabledTypes: Schema.Array(notificationTypesSchema),
    emailEnabled: Schema.Boolean,
    emailDigest: emailDigestTypesSchema,
    updatedAt: Schema.Number,
  })
).index("by_userId", ["userId"]);

/** notificationEntityMutes table definition. */
export const NotificationEntityMutes = Table.make(
  "notificationEntityMutes",
  Schema.Struct({
    entityId: notificationEntityIdSchema,
    entityType: notificationEntityTypesSchema,
    mutedAt: Schema.Number,
    userId: GenericId.GenericId("users"),
  })
)
  .index("by_userId", ["userId"])
  .index("by_entityType_and_entityId", ["entityType", "entityId"])
  .index("by_userId_and_entityType_and_entityId", [
    "userId",
    "entityType",
    "entityId",
  ]);

export const tables = [
  Notifications,
  NotificationCounts,
  NotificationPreferences,
  NotificationEntityMutes,
] as const;
