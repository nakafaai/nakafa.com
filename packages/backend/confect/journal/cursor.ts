import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  ConsumedChangeType,
  JournalConsumer,
} from "@repo/backend/confect/journal/schema";
import { Clock, Effect, Option } from "effect";

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
 * Marks one consumer's cursor pending, and creates the cursor when no change of
 * that type has reached the tenant before. A new cursor starts at the current
 * time, so the entries recorded before it are never read. The change that creates
 * it is written in the same transaction, so its entry is not before the start.
 * Two writers that both find no cursor conflict on the index range they read, so
 * only one cursor is created.
 */
export const markPending = Effect.fn("journal.cursor.markPending")(function* (
  consumer: typeof JournalConsumer.Type,
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type
) {
  const writer = yield* DatabaseWriter;
  const cursor = yield* cursorOf(consumer, tenantId, changeType);
  if (Option.isNone(cursor)) {
    const since = yield* Clock.currentTimeMillis;
    yield* writer
      .table("journalCursors")
      .insert({
        changeType,
        consumer,
        pending: true,
        position: null,
        since,
        tenantId,
      })
      .pipe(Effect.orDie);
    return;
  }
  yield* writer
    .table("journalCursors")
    .patch(cursor.value._id, { pending: true })
    .pipe(Effect.orDie);
});

/**
 * Reads one page of the journal entries of one change type in one tenant, after
 * a cursor position. Creation time is the last column of the index, so the range
 * from `since` holds the entries created at or after it, in creation order, and
 * each page holds the next of them.
 */
export const readAfter = Effect.fn("journal.cursor.readAfter")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type,
  since: number,
  position: string | null,
  numItems: number
) {
  return yield* (yield* DatabaseReader)
    .table("journalEntries")
    .index("by_owner_tenantId_and_change_type", (query) =>
      query
        .eq("owner.tenantId", tenantId)
        .eq("change.type", changeType)
        .gte("_creationTime", since)
    )
    .paginate({ cursor: position, numItems })
    .pipe(Effect.orDie);
});

/** Saves where one run stopped, and whether a further run is owed. */
export const advance = Effect.fn("journal.cursor.advance")(function* (
  cursorId: GenericId.GenericId<"journalCursors">,
  position: string,
  pending: boolean
) {
  yield* (yield* DatabaseWriter)
    .table("journalCursors")
    .patch(cursorId, { pending, position })
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
