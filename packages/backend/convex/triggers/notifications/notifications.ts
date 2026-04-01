import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { notificationWorkpool } from "@repo/backend/convex/notifications/workpool";
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

  await notificationWorkpool.enqueueMutation(
    ctx,
    internal.notifications.mutations.decrementUnreadNotificationCount,
    { userId: change.oldDoc.recipientId }
  );
}
