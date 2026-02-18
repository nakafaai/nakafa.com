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
 * Future enhancements:
 * - Check user preferences (disabledTypes, mutedEntities)
 * - Send push notifications
 * - Send email notifications based on digest settings
 */
export async function createNotification(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: Omit<WithoutSystemFields<Doc<"notifications">>, "readAt">
) {
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
    .withIndex("userId", (q) => q.eq("userId", args.recipientId))
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
