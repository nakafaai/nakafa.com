import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  JOURNAL_COMMIT_LAG,
  type Position,
} from "@repo/backend/confect/journal/cursor";
import type {
  ConsumedChangeType,
  JournalConsumer,
} from "@repo/backend/confect/journal/schema";
import { Effect, Option } from "effect";

/** The cursor of one consumer for one tenant and change type, once a change has reached it. */
export const cursorOf = Effect.fn("journal.cursor.of")(function* (
  consumer: typeof JournalConsumer.Type,
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type
) {
  return yield* (yield* DatabaseReader)
    .table("journalCursors")
    .get(
      "by_consumer_and_tenantId_and_changeType",
      consumer,
      tenantId,
      changeType
    )
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/**
 * Marks one consumer's cursor pending, and creates the cursor when no change of that type
 * has reached the tenant before. `entryId` is the journal entry whose write marks the
 * cursor, recorded in the same transaction. A new cursor starts `JOURNAL_COMMIT_LAG`
 * before that entry's own creation time, read from the stored entry, so the first run reads
 * the entries created in that window before the entry, whatever their commit time, and
 * nothing older. The start is the entry and not a clock reading, because a clock read at
 * another moment could start after the entry that made the cursor and skip it. Two writers
 * that both find no cursor conflict on the index range they read, so only one cursor is created.
 * Returns whether the cursor was already pending. Then a run is owed and already scheduled,
 * so the caller schedules none, and the pending cursor is not written again.
 */
export const markPending = Effect.fn("journal.cursor.markPending")(function* (
  consumer: typeof JournalConsumer.Type,
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type,
  entryId: GenericId.GenericId<"journalEntries">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const cursor = yield* cursorOf(consumer, tenantId, changeType);
  if (Option.isNone(cursor)) {
    const entry = yield* reader
      .table("journalEntries")
      .get(entryId)
      .pipe(Effect.orDie);
    yield* writer
      .table("journalCursors")
      .insert({
        changeType,
        consumer,
        handled: [],
        pending: true,
        since: entry._creationTime - JOURNAL_COMMIT_LAG,
        tenantId,
      })
      .pipe(Effect.orDie);
    return false;
  }
  if (cursor.value.pending) {
    return true;
  }
  yield* writer
    .table("journalCursors")
    .patch(cursor.value._id, { pending: true })
    .pipe(Effect.orDie);
  return false;
});

/**
 * Reads the journal entries of one change type in one tenant that a run may need: those
 * created at or after `since`, in creation order. The read takes one page of the page size,
 * the handled entries, and one more entry, so it stays bounded and knows whether entries
 * remain. `planRun` skips the handled entries that it returns.
 */
export const readAfter = Effect.fn("journal.cursor.readAfter")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type,
  position: Position,
  numItems: number
) {
  return yield* (yield* DatabaseReader)
    .table("journalEntries")
    .index("by_owner_tenantId_and_change_type", (query) =>
      query
        .eq("owner.tenantId", tenantId)
        .eq("change.type", changeType)
        .gte("_creationTime", position.since)
    )
    .take(numItems + position.handled.length + 1)
    .pipe(Effect.orDie);
});

/** Saves where one run stopped, and whether a further run is owed. */
export const advance = Effect.fn("journal.cursor.advance")(function* (
  cursorId: GenericId.GenericId<"journalCursors">,
  position: Position,
  pending: boolean
) {
  yield* (yield* DatabaseWriter)
    .table("journalCursors")
    .patch(cursorId, {
      handled: position.handled,
      pending,
      since: position.since,
    })
    .pipe(Effect.orDie);
});

/** The cursors of one consumer that a change left pending, at most `numItems` of them. */
export const pendingOf = Effect.fn("journal.cursor.pending")(function* (
  consumer: typeof JournalConsumer.Type,
  numItems: number
) {
  return yield* (yield* DatabaseReader)
    .table("journalCursors")
    .index("by_consumer_and_pending", (query) =>
      query.eq("consumer", consumer).eq("pending", true)
    )
    .take(numItems)
    .pipe(Effect.orDie);
});
