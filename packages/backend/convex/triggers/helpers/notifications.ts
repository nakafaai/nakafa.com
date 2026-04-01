import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { notificationWorkpool } from "@repo/backend/convex/notifications/workpool";
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
  ctx: MutationCtx,
  args: Omit<WithoutSystemFields<Doc<"notifications">>, "readAt">
) {
  await notificationWorkpool.enqueueMutation(
    ctx,
    internal.notifications.mutations.deliverNotificationIfAllowed,
    args
  );
}
