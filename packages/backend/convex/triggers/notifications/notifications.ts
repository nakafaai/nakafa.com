import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/** Keeps unread counts in sync when notifications are deleted. */
export async function notificationsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "notifications">
) {
  if (change.operation !== "delete") {
    return;
  }

  if (change.oldDoc.readAt !== undefined) {
    return;
  }

  const existingCount = await ctx.db
    .query("notificationCounts")
    .withIndex("userId", (q) => q.eq("userId", change.oldDoc.recipientId))
    .unique();

  if (!existingCount) {
    return;
  }

  await ctx.db.patch("notificationCounts", existingCount._id, {
    unreadCount: Math.max(0, existingCount.unreadCount - 1),
    updatedAt: Date.now(),
  });
}
