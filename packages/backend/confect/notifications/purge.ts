import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Array as Arr, Duration, Effect, Option } from "effect";

/**
 * Inbox rows one purge page deletes, inside one transaction. It is half of the 100
 * entries that one page of a list may hold (ADR 0016).
 */
const PURGE_PAGE_SIZE = 50;

/**
 * Deletes up to one page of a Person's inbox rows, and reports whether rows
 * remain. It reads one row past the page to know that, so a last full page does
 * not schedule an empty run.
 */
const deletePage = Effect.fn("notifications.purge.page")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  numItems: number
) {
  const rows = yield* (yield* DatabaseReader)
    .table("notifications")
    .index("by_recipientPersonId_and_createdAt", (query) =>
      query.eq("recipientPersonId", personId)
    )
    .take(numItems + 1)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    Arr.take(rows, numItems),
    (row) => writer.table("notifications").delete(row._id).pipe(Effect.orDie),
    { discard: true }
  );
  return rows.length > numItems;
});

/**
 * Deletes the inbox rows of a released Person, one page at a time. The first page
 * is deleted in the transaction that releases the Person. Each further page is a
 * scheduled run, so no number of rows is read or written in one transaction.
 */
export const purgeInbox = Effect.fn("notifications.purge.inbox")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  if (yield* deletePage(personId, PURGE_PAGE_SIZE)) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.notifications.purge.run,
      { personId }
    );
  }
});

/**
 * Deletes the inbox row of one invitation when the invitation is revoked, in the
 * caller's transaction, so no row points at a revoked invitation. A Person has one
 * row for each invitation, so the lookup is one indexed read. An invitation with no
 * row yet has nothing to delete.
 */
export const purgeInvite = Effect.fn("notifications.purge.invite")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  inviteId: GenericId.GenericId<"tenantInvites">
) {
  const row = yield* (yield* DatabaseReader)
    .table("notifications")
    .get("by_recipientPersonId_and_inviteId", personId, inviteId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isSome(row)) {
    yield* (yield* DatabaseWriter).table("notifications").delete(row.value._id);
  }
});
