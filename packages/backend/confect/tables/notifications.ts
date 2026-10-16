import { Table } from "@confect/core";
import { Notification } from "@repo/backend/confect/notifications/schema";
export default Table.make(() => Notification)
  .index("by_recipientPersonId_and_createdAt", [
    "recipientPersonId",
    "createdAt",
  ])
  .index("by_recipientPersonId_and_inviteId", [
    "recipientPersonId",
    "inviteId",
  ]);
