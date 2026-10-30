import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { JOURNAL_COMMIT_LAG } from "@repo/backend/confect/journal/cursor";
import {
  consumeInboxPage,
  INBOX_PAGE_SIZE,
  invitedInboxSends,
  noteInvite,
} from "@repo/backend/confect/notifications/inbox";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  addPerson,
  burstOf,
  consumeSchool,
  cursors,
  type Fixture,
  inboxRuns,
  inviteAt,
  invitedEntry,
  NOW,
  storedRows,
} from "@repo/backend/test/inbox";
import {
  invitePerson,
  journal,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The journal entry that an invitation row was read from; a class row has none. */
const entryOf = (row: NotificationsDoc) =>
  row.changeType === "person.invited" ? row.journalEntryId : null;

const GURU = "guru@harapan.example.test";
const LAIN = "lain@lain.example.test";
const lain = Schema.decodeSync(Email)(LAIN);

/** Invitations written inside one window: more than one run must hold them, and more than one page. */
const BURST = 120;

describe("notifications/inbox invitedInboxSends", () => {
  it("gives an invitee exactly the inbox send of the rules, due at the change", () => {
    // A send on another channel, or no filter at all, would fail here: the
    // invitation's email send is also due at once, so only this check tells them apart.
    expect(invitedInboxSends).toEqual([
      { channel: "inbox", timing: { _tag: "Now" } },
    ]);
  });
});

/** Where a drain stands between two runs: how many runs it made, and when the next is due. */
const DrainState = Schema.Struct({
  made: Schema.Finite,
  pending: Schema.Boolean,
  runAt: Schema.Finite,
});

/** Runs the inbox at `state.runAt`, and reads when the run that the cursor scheduled last is due. */
const drainRun = (fixture: Fixture, state: typeof DrainState.Type) =>
  Effect.gen(function* () {
    vi.setSystemTime(state.runAt);
    yield* consumeSchool(fixture, fixture.tenants.nf);
    const [cursor] = yield* cursors(fixture);
    expect(cursor).toBeDefined();
    expect(cursor.handled.length).toBeLessThanOrEqual(INBOX_PAGE_SIZE);
    const made = state.made + 1;
    if (!cursor.pending) {
      return { made, pending: false, runAt: state.runAt };
    }
    const next = yield* Effect.map(inboxRuns(fixture), Arr.last);
    if (Option.isNone(next)) {
      return yield* Effect.die("A pending cursor must have a scheduled run.");
    }
    return { made, pending: true, runAt: next.value.scheduledTime };
  });

/**
 * Runs the inbox at each run time that the last run scheduled, until the cursor is not
 * pending, and returns how many runs it made. A cursor still pending at the end fails.
 */
const drain = (fixture: Fixture, start: number) =>
  Effect.reduce(
    Arr.makeBy(BURST, (index) => index),
    () => ({ made: 0, pending: true, runAt: start }),
    (state) =>
      state.pending ? drainRun(fixture, state) : Effect.succeed(state)
  ).pipe(
    Effect.map((state) => {
      expect(state.pending).toBe(false);
      return state.made;
    })
  );

describe("notifications/inbox run", () => {
  /** Fake timers keep every scheduled run from starting before the test looks at it. */
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it.effect(
    "reads an invitation created inside the window before the entry that starts its cursor",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // An invitation recorded before any cursor exists, created three seconds before
        // the entry that starts one.
        const earlier = yield* invitedEntry(fixture, 0);
        vi.setSystemTime(NOW + 3000);
        const first = yield* invitedEntry(fixture, 1);
        yield* fixture.run(noteInvite(fixture.tenants.nf, first));
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(Arr.map(yield* storedRows(fixture), entryOf)).toEqual([
          earlier,
          first,
        ]);
      })
  );

  it.effect(
    "reads an invitation that commits after a run read past its time, while it is still inside the window",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // The first Person is removed before any run, so its entry writes no row.
        const removed = yield* addPerson(fixture, fixture.tenants.nf, "Pergi");
        const late = yield* addPerson(fixture, fixture.tenants.nf, "Lain");
        yield* inviteAt(fixture, "nf", removed, GURU);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").patch(removed, { status: "removed" })
          )
        );
        // The run reads the entry while it is unsettled, and it writes nothing.
        vi.setSystemTime(NOW + 2000);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toEqual([]);
        // The second invitation was created at NOW + 1000, and it commits after that run.
        vi.setSystemTime(NOW + 1000);
        yield* inviteAt(fixture, "nf", late, LAIN);
        vi.setSystemTime(NOW + 7000);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.recipientPersonId)
        ).toEqual([late]);
      })
  );

  it.effect("starts one run for a burst, not one for each invitation", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* burstOf(fixture, BURST);
      expect(yield* inboxRuns(fixture)).toHaveLength(1);
    })
  );

  it.effect(
    "drains a burst of invitations larger than one run may hold, with one row each and no refusal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* burstOf(fixture, BURST);
        const made = yield* drain(fixture, NOW);
        expect(made).toBeGreaterThan(1);
        const rows = yield* storedRows(fixture);
        expect(rows).toHaveLength(BURST);
        expect(Arr.dedupe(Arr.map(rows, entryOf))).toHaveLength(BURST);
        expect(yield* cursors(fixture)).toMatchObject([{ pending: false }]);
      })
  );

  it.effect(
    "schedules the run that takes the entries left at the bound for the moment the oldest of them settles",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* burstOf(fixture, INBOX_PAGE_SIZE + 10);
        // The run stops at the handled limit, which keeps one slot free.
        yield* fixture.run(
          consumeInboxPage(fixture.tenants.nf, INBOX_PAGE_SIZE + 10)
        );
        expect(yield* storedRows(fixture)).toHaveLength(INBOX_PAGE_SIZE - 1);
        const [cursor] = yield* cursors(fixture);
        expect(cursor).toMatchObject({ pending: true });
        expect(cursor.handled).toHaveLength(INBOX_PAGE_SIZE - 1);
        // The first unread entry comes right after the handled ones.
        const left = Arr.get(yield* fixture.run(journal), INBOX_PAGE_SIZE - 1);
        const next = yield* Effect.map(inboxRuns(fixture), Arr.last);
        if (Option.isNone(left) || Option.isNone(next)) {
          return yield* Effect.die("The burst must leave an entry, and a run.");
        }
        expect(next.value.scheduledTime).toBeCloseTo(
          Math.ceil(left.value._creationTime + JOURNAL_COMMIT_LAG),
          0
        );
      })
  );

  it.effect("skips an entry whose Person was removed, and moves past it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteAt(fixture, "nf", fixture.invited, GURU);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantPeople")
            .patch(fixture.invited, { status: "removed" })
        )
      );
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* storedRows(fixture)).toEqual([]);
      expect(yield* cursors(fixture)).toMatchObject([
        {
          handled: [
            { createdAt: expect.any(Number), entryId: expect.any(String) },
          ],
          pending: false,
        },
      ]);
    })
  );

  it.effect("skips an entry whose Person no longer exists", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const gone = yield* addPerson(fixture, fixture.tenants.nf, "Pergi");
      yield* inviteAt(fixture, "nf", gone, GURU);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeople").delete(gone)
        )
      );
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* storedRows(fixture)).toEqual([]);
      expect(yield* cursors(fixture)).toMatchObject([{ pending: false }]);
    })
  );

  it.effect("skips an entry that names a Person of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, lain)
      );
      const entryId = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("journalEntries").insert({
            actor: { kind: "system" },
            change: { invite: inviteId, type: "person.invited" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: {
              id: fixture.people.otherOwner.personId,
              kind: "person",
            },
          })
        )
      );
      yield* fixture.run(noteInvite(fixture.tenants.nf, entryId));
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* storedRows(fixture)).toEqual([]);
    })
  );

  it.effect("does nothing for a school that no invite has reached", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* consumeSchool(fixture, fixture.tenants.other);
      expect(yield* storedRows(fixture)).toEqual([]);
      expect(yield* cursors(fixture)).toEqual([]);
    })
  );
});
