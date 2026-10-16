import type { GenericId } from "@confect/core";
import type { JournalEntriesDoc } from "@repo/backend/confect/_generated/docs";
import type { JournalCursor } from "@repo/backend/confect/journal/schema";
import { Array as Arr, Duration, Option } from "effect";

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
export type Position = Pick<typeof JournalCursor.Type, "handled" | "since">;

/** The part of a journal entry that a cursor needs: its ID and its creation time. */
type EntryRef = Pick<JournalEntriesDoc, "_creationTime" | "_id">;

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
 * Plans one run: the entries of one page to handle, the new position, and when the next run
 * is due. The page is read from `since` in creation order, and entries the position already
 * handled are skipped. Settled entries at the front are handled, and `since` moves to the
 * newest of them. Then unsettled entries are handled early while `handled` has room, and each
 * keeps a record, because `since` may not pass it yet. One slot of `handled` stays free for the
 * record of a settled entry: a late commit can be older than every unsettled entry already
 * handled. Entries that share the new `since` time each keep a record, so a group larger than
 * the free slot can take `handled` past its limit. The design does not bound such a group; it
 * assumes the group stays small. `nextRunAt` is now when the next run can handle an entry at
 * once, the moment the oldest unread entry settles when it cannot, and undefined when no entry
 * is unread. Records before the new `since` are dropped.
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
  const free = handledLimit - 1 - kept.length;
  const early = Arr.take(
    rest,
    Math.max(0, Math.min(pageSize - lead.length, free))
  );
  const handled = Arr.appendAll(kept, Arr.map(early, handledOf));
  const nextRunAt = Option.match(Arr.head(Arr.drop(rest, early.length)), {
    onNone: () => undefined,
    onSome: (entry) => {
      const nextRoom = handledLimit - 1 - handled.length;
      return entry._creationTime <= settled || nextRoom > 0
        ? now
        : Math.ceil(entry._creationTime + JOURNAL_COMMIT_LAG);
    },
  });
  return {
    handle: Arr.appendAll(lead, early),
    nextRunAt,
    position: { handled, since },
  };
};
