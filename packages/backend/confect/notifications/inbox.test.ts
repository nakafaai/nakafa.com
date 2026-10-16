import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
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
  consumeSchool,
  cursors,
  type Fixture,
  inboxRuns,
  inviteAt,
  invitedEntry,
  NOW,
  storedRows,
} from "@repo/backend/test/inbox";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, Schema } from "effect";

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

/** The journal entries of the school's invitations, oldest first. */
const invitedEntries = (fixture: Fixture) =>
  fixture
    .run(
      Effect.flatMap(DatabaseReader, (reader) =>
        reader.table("journalEntries").index("by_creation_time").take(200)
      )
    )
    .pipe(
      Effect.map((entries) =>
        Arr.filter(entries, (entry) => entry.change.type === "person.invited")
      )
    );

/**
 * Writes `count` invitations of the school, each as its own invite mutation would. The
 * first one starts the school's cursor, and every one falls inside one window.
 */
const burstOf = (fixture: Fixture, count: number) =>
  Effect.gen(function* () {
    const first = yield* invitedEntry(fixture, 0);
    yield* fixture.run(noteInvite(fixture.tenants.nf, first));
    yield* Effect.forEach(
      Arr.makeBy(count - 1, (index) => index + 1),
      (index) => invitedEntry(fixture, index),
      { discard: true }
    );
  });

/** The run that was scheduled last, the one a scheduler starts next. */
const newestRun = (fixture: Fixture) =>
  Effect.map(inboxRuns(fixture), Arr.last);

/** Where a drain stands between two of its runs: how many runs it made, and when the next one is due. */
const DrainState = Schema.Struct({
  made: Schema.Finite,
  pending: Schema.Boolean,
  runAt: Schema.Finite,
});

/**
 * Runs the inbox of the school at `state.runAt`, and reads the time of the run that the
 * cursor schedules next. After the run, the handled list holds no more than one page of
 * entries.
 */
const drainRun = (fixture: Fixture, state: typeof DrainState.Type) =>
  Effect.gen(function* () {
    vi.setSystemTime(state.runAt);
    yield* consumeSchool(fixture, fixture.tenants.nf);
    const [cursor] = yield* cursors(fixture);
    expect(cursor).toBeDefined();
    expect(cursor?.handled.length ?? 0).toBeLessThanOrEqual(INBOX_PAGE_SIZE);
    const made = state.made + 1;
    if (cursor === undefined || !cursor.pending) {
      return { made, pending: false, runAt: state.runAt };
    }
    const next = yield* newestRun(fixture);
    if (Option.isNone(next)) {
      return yield* Effect.die("A pending cursor must have a scheduled run.");
    }
    return { made, pending: true, runAt: next.value.scheduledTime };
  });

/**
 * Runs the inbox of the school at the time of each run that the last one scheduled, as the
 * scheduler starts them, until the cursor is not pending, and returns how many runs it made.
 * A burst of `BURST` entries must drain in fewer runs than it has entries. The runs are a
 * bounded sequence, so a cursor that is still pending at its end fails the test.
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
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.journalEntryId)
        ).toEqual([earlier, first]);
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
        expect(
          Arr.dedupe(Arr.map(rows, (row) => row.journalEntryId))
        ).toHaveLength(BURST);
        expect(yield* cursors(fixture)).toMatchObject([{ pending: false }]);
      })
  );

  it.effect(
    "schedules the run that takes the entries left at the bound for the moment the oldest of them settles",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* burstOf(fixture, INBOX_PAGE_SIZE + 10);
        // A page larger than the handled limit stops this run at the limit.
        yield* fixture.run(
          consumeInboxPage(fixture.tenants.nf, INBOX_PAGE_SIZE + 10)
        );
        expect(yield* storedRows(fixture)).toHaveLength(INBOX_PAGE_SIZE);
        const [cursor] = yield* cursors(fixture);
        expect(cursor).toMatchObject({ pending: true });
        expect(cursor?.handled).toHaveLength(INBOX_PAGE_SIZE);
        const invited = yield* invitedEntries(fixture);
        const left = Arr.get(invited, INBOX_PAGE_SIZE);
        if (Option.isNone(left)) {
          return yield* Effect.die("The burst must leave an entry unread.");
        }
        const next = yield* newestRun(fixture);
        if (Option.isNone(next)) {
          return yield* Effect.die(
            "The run that stopped must schedule the next one."
          );
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

  it.effect("skips an entry whose subject is not a Person", () =>
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
            subject: { id: fixture.units.sma, kind: "unit" },
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
