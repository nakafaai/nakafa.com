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
 * Journal entries one run reads. A run reads and writes at most this many
 * entries and rows, far inside the transaction limits of Convex (4,096 index
 * ranges and 32,000 documents scanned per query or mutation).
 */
export const INBOX_PAGE_SIZE = 50;

/** Cursors one sweep starts, so a long backlog drains over several sweeps. */
const DUE_BATCH_SIZE = 50;

/**
 * The sends of the rules that reach the inbox of an invitee. The rules own who
 * receives what (ADR 0027), so this consumer writes a row for each of them and
 * names no channel of its own. The invitation's inbox send is `Now`: it is due at
 * the change, which is the creation time of the journal entry.
 */
const inboxSends = Arr.filter(
  deliveriesOf("invitation", "invitee", false),
  (send) => send.channel === "inbox"
);

/** One journal entry as a page of the journal returns it. */
type Entry = Effect.Success<ReturnType<typeof readAfter>>["page"][number];

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
 * Writes the inbox row of the invitation that one journal entry records. A
 * Person that is missing, removed, or in another school gets no row, and neither
 * does an invitation that is revoked by the time its run reads it, such as the
 * one a release revokes. A row that exists already is kept, so a run that reads
 * an entry again writes nothing new.
 */
const writeRow = Effect.fn("notifications.inbox.writeRow")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  entry: Entry,
  personId: GenericId.GenericId<"tenantPeople">
) {
  const reader = yield* DatabaseReader;
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
    .get("by_journalEntryId_and_recipientPersonId", entry._id, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isSome(existing)) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("notifications")
    .insert({
      changeType: CHANGE,
      createdAt: entry._creationTime,
      journalEntryId: entry._id,
      recipientPersonId: personId,
      subject: entry.subject,
      tenantId,
    })
    .pipe(Effect.orDie);
});

/**
 * Runs the inbox consumer for one tenant. It reads one page of the tenant's
 * invitations recorded since the cursor started, after the cursor's position,
 * writes their rows, and moves the cursor to the end of the page in the same
 * transaction, so a run that fails writes nothing. A page that is not the last
 * one schedules the next run.
 */
export const consumeInboxPage = Effect.fn("notifications.inbox.consume")(
  function* (tenantId: GenericId.GenericId<"tenants">, numItems: number) {
    const cursor = yield* cursorOf(CONSUMER, tenantId, CHANGE);
    if (Option.isNone(cursor)) {
      return;
    }
    const page = yield* readAfter(
      tenantId,
      CHANGE,
      cursor.value.since,
      cursor.value.position,
      numItems
    );
    yield* Effect.forEach(
      page.page,
      (entry) =>
        ObjectRef.matchOrElse(
          entry.subject,
          {
            person: (subject) =>
              Effect.forEach(
                inboxSends,
                () => writeRow(tenantId, entry, subject.id),
                { discard: true }
              ),
          },
          () => Effect.void
        ),
      { discard: true }
    );
    yield* advance(cursor.value._id, page.continueCursor, !page.isDone);
    if (!page.isDone) {
      yield* scheduleRun(tenantId);
    }
  }
);

/**
 * After an invitation is recorded, marks the inbox cursor of its tenant pending
 * and schedules a run. The first invitation of a tenant creates its cursor, which
 * starts at that moment, so only the invitations recorded from then on get rows.
 * The run is the normal path; the minute sweep is the backstop for a run that
 * never happened.
 */
export const noteInvite = Effect.fn("notifications.inbox.noteInvite")(
  function* (tenantId: GenericId.GenericId<"tenants">) {
    yield* markPending(CONSUMER, tenantId, CHANGE);
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
