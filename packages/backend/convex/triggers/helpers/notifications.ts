import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";

/**
 * Helper function to create a notification and update unread count
 *
 * This is the central place for creating notifications.
 * It handles:
 * 1. Creating the notification record (readAt = undefined means unread)
 * 2. Updating the denormalized unread count
 *
 * Navigation URL is built at READ TIME by fetching the entity:
 * - Post → post.forumId → forum.classId → class.schoolId → school.slug
 * - Comment → comment.slug
 * This ensures URLs are always correct even if routing changes.
 *
 * Current preference checks:
 * - Disabled notification types via notificationPreferences.disabledTypes
 * - Muted entities via notificationEntityMutes
 */
export async function createNotification(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: Omit<WithoutSystemFields<Doc<"notifications">>, "readAt">
) {
  const entityId = args.entityId;

  const preferencesPromise = ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
    .first();

  const mutedEntityPromise =
    entityId && args.entityType !== "system"
      ? ctx.db
          .query("notificationEntityMutes")
          .withIndex("by_userId_entityType_entityId", (q) =>
            q
              .eq("userId", args.recipientId)
              .eq("entityType", args.entityType)
              .eq("entityId", entityId)
          )
          .first()
      : Promise.resolve(null);

  const [preferences, mutedEntity] = await Promise.all([
    preferencesPromise,
    mutedEntityPromise,
  ]);

  if (preferences?.disabledTypes.includes(args.type)) {
    return null;
  }

  if (mutedEntity) {
    return null;
  }

  await ctx.db.insert("notifications", {
    recipientId: args.recipientId,
    actorId: args.actorId,
    type: args.type,
    entityType: args.entityType,
    entityId: args.entityId,
    previewTitle: args.previewTitle,
    previewBody: args.previewBody,
  });

  const existingCount = await ctx.db
    .query("notificationCounts")
    .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
    .unique();

  if (existingCount) {
    await ctx.db.patch("notificationCounts", existingCount._id, {
      unreadCount: existingCount.unreadCount + 1,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("notificationCounts", {
      userId: args.recipientId,
      unreadCount: 1,
      updatedAt: Date.now(),
    });
  }
}
