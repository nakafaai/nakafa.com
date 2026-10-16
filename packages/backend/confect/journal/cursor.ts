import type { GenericId } from "@confect/core";
import type { JournalEntriesDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  ConsumedChangeType,
  JournalConsumer,
  JournalCursor,
} from "@repo/backend/confect/journal/schema";
import { Array as Arr, Duration, Effect, Option } from "effect";

/**
 * How far behind the clock a run settles the journal. An entry takes its creation time
 * while its mutation runs, and it becomes visible only when the mutation commits, so an
 * entry can commit after a run has read past its creation time. Convex limits a mutation's
 * user code to one second (the limits page, read on 16 October 2026, which does not count
 * database operations). Five seconds leaves a margin for that database work and the commit.
 * An entry created at or before the settled time is treated as committed, so a run may pass it.
 */
export const JOURNAL_COMMIT_LAG = Duration.toMillis(Duration.seconds(5));

/** Where a cursor's next run reads from: `since`, and the handled entries at or after it. */
type Position = Pick<typeof JournalCursor.Type, "handled" | "since">;

/** The part of a journal entry that a cursor needs: its ID and its creation time. */
type EntryRef = Pick<JournalEntriesDoc, "_creationTime" | "_id">;

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

/** The handled-list record of one journal entry: its creation time and its ID. */
const handledOf = (entry: EntryRef) => ({
  createdAt: entry._creationTime,
  entryId: entry._id,
});

/**
 * Plans one run from its position and one page of the journal, read from `since` in
 * creation order. The page may hold entries the position already handled, and those are
 * skipped. Settled entries lead the page, and the run handles each one, so `since` moves to
 * the newest and the settled entries stay out of `handled`, except those that share the
 * new `since` time, which the next read would otherwise handle again. Behind them the run
 * handles unsettled entries early, while `handled` would hold fewer than `handledLimit` ids,
 * and it keeps each one in `handled`, because `since` may not pass an entry that is not yet
 * settled. The run stops at `pageSize` handled entries, or at the bound, and leaves the rest
 * unread. `nextRunAt` is the time of the next run: now when the page size stopped the run,
 * the moment the oldest unread entry settles when the bound did, and undefined when no entry
 * is left unread. Handled entries before the new `since` are dropped, so the position keeps
 * only what a later read may still need.
 */
export const planRun = <Entry extends EntryRef>(
  now: number,
  position: Position,
  page: readonly Entry[],
  pageSize: number,
  handledLimit: number
) => {
  const settled = now - JOURNAL_COMMIT_LAG;
  const fresh = Arr.filter(
    page,
    (entry) =>
      entry._creationTime >= position.since && !isHandled(position, entry._id)
  );
  const settledRun = Arr.takeWhile(
    fresh,
    (entry) => entry._creationTime <= settled
  );
  const lead = Arr.take(settledRun, pageSize);
  const rest = Arr.drop(fresh, lead.length);
  const since = Option.match(Arr.last(lead), {
    onNone: () => position.since,
    onSome: (entry) => entry._creationTime,
  });
  const kept = Arr.filter(
    Arr.appendAll(position.handled, Arr.map(lead, handledOf)),
    (handled) => handled.createdAt >= since
  );
  const room = Math.max(
    0,
    Math.min(pageSize - lead.length, handledLimit - kept.length)
  );
  const early = Arr.take(rest, room);
  const handle = Arr.appendAll(lead, early);
  const nextRunAt = Option.match(Arr.head(Arr.drop(rest, room)), {
    onNone: () => undefined,
    onSome: (entry) =>
      handle.length >= pageSize
        ? now
        : Math.ceil(entry._creationTime + JOURNAL_COMMIT_LAG),
  });
  return {
    handle,
    nextRunAt,
    position: {
      handled: Arr.appendAll(kept, Arr.map(early, handledOf)),
      since,
    },
  };
};

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
