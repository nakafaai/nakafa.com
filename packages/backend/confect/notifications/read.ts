import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * Inbox rows one read-all page reads, and marks, inside one transaction. It is
 * half of the 100 entries that one page of a list may hold (ADR 0016).
 */
const READ_PAGE_SIZE = 50;

/**
 * Marks the unread rows of one Person on one page, with the moment of the read,
 * and schedules a run for the rest when rows follow. A read row keeps its first
 * moment, so a repeated page writes nothing new. A row created at or after the
 * moment of the request, such as an invitation written after it or a resend, stays
 * unread: the request marks only the rows that existed when it was made. A read-all
 * request marks no rows itself: every page, the first included, is a scheduled run.
 */
export const markPersonRead = Effect.fn("notifications.read.person")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  cursor: string | null,
  readAt: number
) {
  const page = yield* (yield* DatabaseReader)
    .table("notifications")
    .index("by_recipientPersonId_and_createdAt", (query) =>
      query.eq("recipientPersonId", personId)
    )
    .paginate({ cursor, numItems: READ_PAGE_SIZE })
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    Arr.filter(
      page.page,
      (row) => row.readAt === undefined && row.createdAt < readAt
    ),
    (row) =>
      writer
        .table("notifications")
        .patch(row._id, { readAt })
        .pipe(Effect.orDie),
    { discard: true }
  );
  if (!page.isDone) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.notifications.read.run,
      { cursor: page.continueCursor, personId, readAt }
    );
  }
});
