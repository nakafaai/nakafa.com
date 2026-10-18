import type { Ref } from "@confect/core";
import type notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Array as Arr } from "effect";

/** One inbox row as the list of the signed-in account shows it. */
export type ListNotification = Ref.Returns<
  typeof notifications.inbox.list
>["page"][number];

/**
 * The row with this id, read at the given moment. A row that is read already keeps
 * its first read time, so a repeated press counts once, and every other row stays
 * as it is.
 */
export function markRowRead(
  page: readonly ListNotification[],
  notificationId: ListNotification["id"],
  readAt: number
) {
  return Arr.map(page, (row) =>
    row.id === notificationId && row.readAt === undefined
      ? { ...row, readAt }
      : row
  );
}

/**
 * Every unread row of the page, read at the given moment. A row that is read
 * already keeps its own read time.
 */
export function markPageRead(
  page: readonly ListNotification[],
  readAt: number
) {
  return Arr.map(page, (row) =>
    row.readAt === undefined ? { ...row, readAt } : row
  );
}
