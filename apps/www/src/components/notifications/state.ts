import type { Ref } from "@confect/core";
import type notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";

/** One inbox row as the list of the signed-in account shows it. */
export type ListNotification = Ref.Returns<
  typeof notifications.inbox.list
>["page"][number];

/** An inbox row of the account itself: a reply to its comment, or a reminder of its running try-out. */
type AccountNotification = Extract<
  ListNotification,
  { readonly changeType: "comment.replied" | "tryout.reminder" }
>;

/** An inbox row that a school holds, not one of the account itself. */
export type SchoolNotification = Exclude<ListNotification, AccountNotification>;

/** Whether an inbox row is the account's own rather than a school's. */
const isAccountNotification = (
  row: ListNotification
): row is AccountNotification =>
  row.changeType === "comment.replied" || row.changeType === "tryout.reminder";

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
 * Every unread row of the page, read at the given moment, or only those of the
 * school that `slug` names. A row that is read already keeps its own read time.
 */
export function markPageRead(
  page: readonly ListNotification[],
  readAt: number,
  slug: TenantSlug | undefined
) {
  return Arr.map(page, (row) =>
    row.readAt === undefined &&
    (slug === undefined ||
      (!isAccountNotification(row) && row.tenant.slug === slug))
      ? { ...row, readAt }
      : row
  );
}
