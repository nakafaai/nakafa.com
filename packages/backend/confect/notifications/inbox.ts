import type { GenericId } from "@confect/core";
import type { JournalEntriesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import { planRun } from "@repo/backend/confect/journal/cursor";
import type {
  ConsumedChangeType,
  JournalConsumer,
} from "@repo/backend/confect/journal/schema";
import {
  advance,
  cursorOf,
  markPending,
  pendingOf,
  readAfter,
} from "@repo/backend/confect/journal/store";
import { deliveriesOf } from "@repo/backend/confect/notifications/delivery";
import { Array as Arr, Clock, Duration, Effect, Option, Schema } from "effect";

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
 * The most ids one cursor keeps handled (see `planRun`). It is the page size, so the
 * ids of one cursor never outgrow one page, and a run reads at most two pages of the
 * journal: one page of new entries beside the handled ones, plus one entry to know
 * whether entries remain. A burst longer than this drains over several runs, which
 * `consumeInboxPage` schedules, and nothing is refused.
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

/** Schedules one run of the inbox consumer for a tenant after `delay`. The run starts only if the calling transaction commits. */
const scheduleRun = Effect.fn("notifications.inbox.scheduleRun")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  delay: Duration.Duration
) {
  yield* (yield* Scheduler).runAfter(
    delay,
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
  entry: JournalEntriesDoc,
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
 * Runs the inbox consumer for one tenant. It reads one page of the tenant's journal
 * entries after the cursor, writes the rows of the invitations it handles, and moves
 * the cursor in the same transaction, so a run that fails writes nothing. When entries
 * are left unread, it schedules the next run for the time `planRun` gives, so a burst
 * drains without the minute sweep.
 */
export const consumeInboxPage = Effect.fn("notifications.inbox.consume")(
  function* (tenantId: GenericId.GenericId<"tenants">, numItems: number) {
    const cursor = yield* cursorOf(CONSUMER, tenantId, CHANGE);
    if (Option.isNone(cursor)) {
      return;
    }
    const now = yield* Clock.currentTimeMillis;
    const page = yield* readAfter(tenantId, CHANGE, cursor.value, numItems);
    const plan = planRun(now, cursor.value, page, numItems, HANDLED_LIMIT);
    yield* Effect.forEach(
      plan.handle,
      // The journal's union holds a `person.invited` change only under a Person
      // subject, so the subject decodes as a Person. Every inbox send of the
      // invitation shows in the one row of the invitation, so the row is written
      // once whatever the number of sends.
      (entry) =>
        Schema.decodeUnknownEffect(ObjectRef.cases.person)(entry.subject).pipe(
          Effect.orDie,
          Effect.flatMap((subject) =>
            Effect.forEach(
              invitedInboxSends,
              () => writeRow(tenantId, entry, subject.id),
              { discard: true }
            )
          )
        ),
      { discard: true }
    );
    const { nextRunAt } = plan;
    yield* advance(cursor.value._id, plan.position, Option.isSome(nextRunAt));
    if (Option.isSome(nextRunAt)) {
      yield* scheduleRun(tenantId, Duration.millis(nextRunAt.value - now));
    }
  }
);

/**
 * After an invitation is recorded, marks the inbox cursor of its tenant pending. A run
 * is scheduled only when none is owed already: a pending cursor has one, and that run
 * reads this entry too, or schedules the run that does. So a burst of invitations starts
 * one chain of runs, not one run for each invitation. `entryId` is the journal entry that
 * the write recorded in the same transaction. The first invitation of a tenant creates
 * its cursor five seconds before that entry, so the first run reads the invitations
 * created in that window before it, whatever their commit time, and an invitation created
 * earlier gets no row. The minute sweep is the backstop for a run that failed or never
 * happened.
 */
export const noteInvite = Effect.fn("notifications.inbox.noteInvite")(
  function* (
    tenantId: GenericId.GenericId<"tenants">,
    entryId: GenericId.GenericId<"journalEntries">
  ) {
    const owed = yield* markPending(CONSUMER, tenantId, CHANGE, entryId);
    if (owed) {
      return;
    }
    yield* scheduleRun(tenantId, Duration.zero);
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
    yield* Effect.forEach(
      pending,
      (cursor) => scheduleRun(cursor.tenantId, Duration.zero),
      { discard: true }
    );
  }
);
