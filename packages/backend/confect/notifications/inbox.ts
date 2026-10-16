import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import {
  advance,
  cursorOf,
  markPending,
  pendingOf,
  positionAfter,
  readAfter,
} from "@repo/backend/confect/journal/cursor";
import type {
  ConsumedChangeType,
  JournalConsumer,
} from "@repo/backend/confect/journal/schema";
import { deliveriesOf } from "@repo/backend/confect/notifications/delivery";
import { Array as Arr, Duration, Effect, Option, Schema } from "effect";

/** The consumer that writes the inbox rows of invitations. */
const CONSUMER: typeof JournalConsumer.Type = "inbox";

/** The change that this consumer reads. */
const CHANGE: typeof ConsumedChangeType.Type = "person.invited";

/** The part of a `person.invited` change that names its invite. */
const InvitedChange = Schema.Struct({ invite: Id("tenantInvites") });

/**
 * Journal entries one run reads and writes. It is half of the 100 entries that
 * one page of a list may hold (ADR 0016), so a run stays far inside one Convex
 * transaction.
 */
export const INBOX_PAGE_SIZE = 50;

/**
 * Handled entries that one cursor may keep, so the window of a run holds at most this
 * many. A run reads a page of new entries beside them, so one page of handled entries
 * bounds the read at two pages of the journal, the 100 entries of a list page (ADR
 * 0016), plus one entry to know whether the run is done. A window over this bound
 * fails the run before it writes.
 */
const HANDLED_LIMIT = INBOX_PAGE_SIZE;

/** Cursors one sweep starts, so a long backlog drains over several sweeps. */
const DUE_BATCH_SIZE = 50;

/**
 * The inbox sends that the rules give an invitee, which decide whether the
 * invitee gets an inbox row (ADR 0027). The consumer names no channel of its own,
 * and email stays with `emails/invite`. The invitation's inbox send is `Now`, so
 * its row is due at the change, the creation time of the journal entry.
 */
export const invitedInboxSends = Arr.filter(
  deliveriesOf("invitation", "invitee", false),
  (send) => send.channel === "inbox"
);

/** One journal entry as a read of the journal returns it. */
type Entry = Effect.Success<ReturnType<typeof readAfter>>["entries"][number];

/** Schedules one run of the inbox consumer for a tenant. The run starts only if the calling transaction commits. */
const scheduleRun = Effect.fn("notifications.inbox.scheduleRun")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.notifications.consume.run,
    { tenantId }
  );
});

/**
 * Writes the inbox row of the invitation that one journal entry records. A Person
 * that is missing, removed, or in another school gets no row, and neither does an
 * invitation that is revoked by the time its run reads it. A Person has one row for
 * each invitation, found by the Person and the invitation. An entry that resends
 * the invitation refreshes that row: the row takes the entry's time and is unread
 * again. An entry no newer than the row writes nothing, so a run that reads the
 * same entries again changes nothing.
 */
const writeRow = Effect.fn("notifications.inbox.writeRow")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  entry: Entry,
  personId: GenericId.GenericId<"tenantPeople">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (
    Option.isNone(person) ||
    person.value.tenantId !== tenantId ||
    person.value.status !== "active"
  ) {
    return;
  }
  const { invite } = yield* Schema.decodeUnknownEffect(InvitedChange)(
    entry.change
  ).pipe(Effect.orDie);
  const stored = yield* reader
    .table("tenantInvites")
    .get(invite)
    .pipe(Effect.orDie);
  if (stored.state.status === "revoked") {
    return;
  }
  const existing = yield* reader
    .table("notifications")
    .get("by_recipientPersonId_and_inviteId", personId, invite)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isNone(existing)) {
    yield* writer
      .table("notifications")
      .insert({
        changeType: CHANGE,
        createdAt: entry._creationTime,
        inviteId: invite,
        journalEntryId: entry._id,
        recipientPersonId: personId,
        subject: entry.subject,
        tenantId,
      })
      .pipe(Effect.orDie);
    return;
  }
  // A row takes the creation time of the entry that wrote it, so a row at or after
  // this entry's time already reflects this entry or a later one.
  const row = existing.value;
  if (row.createdAt >= entry._creationTime) {
    return;
  }
  yield* writer
    .table("notifications")
    .patch(row._id, {
      createdAt: entry._creationTime,
      journalEntryId: entry._id,
      readAt: undefined,
    })
    .pipe(Effect.orDie);
});

/**
 * Runs the inbox consumer for one tenant. It reads one page of the tenant's
 * journal entries of invitations in the cursor's window, writes their rows, and
 * moves the cursor past the page in the same transaction, so a run that fails
 * writes nothing. A window over `HANDLED_LIMIT` fails the run before the first
 * write. A page that is not the last one schedules the next run.
 */
export const consumeInboxPage = Effect.fn("notifications.inbox.consume")(
  function* (tenantId: GenericId.GenericId<"tenants">, numItems: number) {
    const cursor = yield* cursorOf(CONSUMER, tenantId, CHANGE);
    if (Option.isNone(cursor)) {
      return;
    }
    const page = yield* readAfter(tenantId, CHANGE, cursor.value, numItems);
    const next = yield* positionAfter(
      cursor.value,
      page.entries,
      HANDLED_LIMIT
    );
    yield* Effect.forEach(
      page.entries,
      (entry) =>
        ObjectRef.matchOrElse(
          entry.subject,
          {
            // Every inbox send of the invitation shows in the one row of the
            // invitation, so the row is written once whatever the number of sends.
            person: (subject) =>
              Effect.forEach(
                invitedInboxSends,
                () => writeRow(tenantId, entry, subject.id),
                { discard: true }
              ),
          },
          () => Effect.void
        ),
      { discard: true }
    );
    yield* advance(cursor.value._id, next, !page.isDone);
    if (!page.isDone) {
      yield* scheduleRun(tenantId);
    }
  }
);

/**
 * After an invitation is recorded, marks the inbox cursor of its tenant pending
 * and schedules a run. `entryId` is the journal entry that the write recorded in
 * the same transaction. The first invitation of a tenant creates its cursor at
 * that entry, and the first run reads the entries created inside the commit-lag
 * window before it, whatever their commit time. So an invitation created up to five
 * seconds before the first one gets a row, and one created earlier gets none. The
 * run is the normal path; the minute sweep is the backstop for a run that never
 * happened.
 */
export const noteInvite = Effect.fn("notifications.inbox.noteInvite")(
  function* (
    tenantId: GenericId.GenericId<"tenants">,
    entryId: GenericId.GenericId<"journalEntries">
  ) {
    yield* markPending(CONSUMER, tenantId, CHANGE, entryId);
    yield* scheduleRun(tenantId);
  }
);

/**
 * Starts a run for each inbox cursor that a change left pending, a batch at a
 * time. Each run is its own transaction, so one failing tenant does not stop the
 * others.
 */
export const scheduleDueRuns = Effect.fn("notifications.inbox.scheduleDue")(
  function* () {
    const pending = yield* pendingOf(CONSUMER, DUE_BATCH_SIZE);
    yield* Effect.forEach(pending, (cursor) => scheduleRun(cursor.tenantId), {
      discard: true,
    });
  }
);
