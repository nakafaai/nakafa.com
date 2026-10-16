import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { JournalCursorTooLarge } from "@repo/backend/confect/journal/errors";
import type {
  ConsumedChangeType,
  JournalConsumer,
  JournalCursor,
} from "@repo/backend/confect/journal/schema";
import { Array as Arr, Duration, Effect, Option } from "effect";

/**
 * How far behind a cursor's `since` a run reads. Convex limits a query or a mutation
 * to one second of user code (https://docs.convex.dev/production/state/limits, read
 * on 16 October 2026). An entry takes its creation time while its mutation runs and
 * becomes visible when the mutation commits, so it can commit after a run has moved
 * `since` past its creation time. Five seconds covers that second of user code with a
 * margin for retries and the commit, and a run that reads this window again finds such
 * an entry.
 */
const JOURNAL_COMMIT_LAG = Duration.toMillis(Duration.seconds(5));

/** Where a cursor's next run reads from: the newest entry handled, and the entries handled in the window behind it. */
type Position = Pick<typeof JournalCursor.Type, "handled" | "since">;

/** One journal entry as a read of the journal returns it. */
type Entry = Effect.Success<ReturnType<typeof readAfter>>["entries"][number];

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
 * that type has reached the tenant before. `entryId` is the journal entry whose
 * write marks the cursor, recorded in the same transaction. A new cursor starts at
 * that entry's own creation time, read from the stored entry, and holds no handled
 * entry, so the first run reads that entry. The start is the entry and not a clock
 * reading, because a clock read at another moment could start after the entry that
 * made the cursor and skip it. An entry created before the start is read only inside
 * the commit-lag window, which holds the entries that committed late. Two writers that
 * both find no cursor conflict on the index range they read, so only one cursor is
 * created.
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
        since: entry._creationTime,
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

/** Whether the position has already handled this entry. */
const isHandled = (
  position: Position,
  entryId: GenericId.GenericId<"journalEntries">
) => Arr.some(position.handled, (handled) => handled.entryId === entryId);

/**
 * Reads the next page of the journal entries of one change type in one tenant: the
 * entries created at or after the commit-lag window behind the position's `since`,
 * in creation order, without the ones the position has handled. It reads one entry
 * past the page, so `isDone` is known without a second read. The read is one indexed
 * `take` of the page, the handled entries, and one more, so it stays bounded.
 */
export const readAfter = Effect.fn("journal.cursor.readAfter")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  changeType: typeof ConsumedChangeType.Type,
  position: Position,
  numItems: number
) {
  const rows = yield* (yield* DatabaseReader)
    .table("journalEntries")
    .index("by_owner_tenantId_and_change_type", (query) =>
      query
        .eq("owner.tenantId", tenantId)
        .eq("change.type", changeType)
        .gte("_creationTime", position.since - JOURNAL_COMMIT_LAG)
    )
    .take(numItems + position.handled.length + 1)
    .pipe(Effect.orDie);
  const fresh = Arr.filter(rows, (entry) => !isHandled(position, entry._id));
  return {
    entries: Arr.take(fresh, numItems),
    isDone: fresh.length <= numItems,
  };
});

/**
 * The position that a run leaves for the next one. `since` moves to the creation time
 * of the newest entry the run read, and the entries the run handled join the handled
 * list. The list keeps only the entries whose creation time lies inside the window
 * behind the new `since`, so an entry leaves the list exactly when no run reads it
 * again. A list longer than `limit` fails with `JournalCursorTooLarge`, so the caller
 * stops before it writes a row that grows without a bound.
 */
export const positionAfter = Effect.fn("journal.cursor.positionAfter")(
  function* (position: Position, entries: readonly Entry[], limit: number) {
    const since = Arr.reduce(entries, position.since, (latest, entry) =>
      Math.max(latest, entry._creationTime)
    );
    const floor = since - JOURNAL_COMMIT_LAG;
    const handled = Arr.filter(
      Arr.appendAll(
        position.handled,
        Arr.map(entries, (entry) => ({
          createdAt: entry._creationTime,
          entryId: entry._id,
        }))
      ),
      (entry) => entry.createdAt >= floor
    );
    if (handled.length > limit) {
      return yield* new JournalCursorTooLarge({
        entries: handled.length,
        limit,
      });
    }
    return { handled, since };
  }
);

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
