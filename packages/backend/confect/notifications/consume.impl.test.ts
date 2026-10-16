import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import {
  consumeInboxPage,
  noteInvite,
} from "@repo/backend/confect/notifications/inbox";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  addPerson,
  claim,
  consumeSchool,
  type Fixture,
  inviteAt,
  NOW,
  nf,
  storedRows,
} from "@repo/backend/test/inbox";
import {
  invitePerson,
  journal,
  scheduledJobs,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, Schema } from "effect";

const GURU = "guru@harapan.example.test";
const lain = Schema.decodeSync(Email)("lain@lain.example.test");
const sweep = refs.internal.notifications.consume.sweep;
const { resend, revoke } = refs.public.tenancy.invites;
const CONSUME_RUN = "notifications/consume:run";

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** Every journal cursor, oldest first. */
const cursors = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("journalCursors").index("by_creation_time").take(50)
    )
  );

/** The scheduled runs of the inbox consumer, as the system table lists them. */
const runs = (fixture: Fixture) =>
  fixture
    .run(scheduledJobs)
    .pipe(
      Effect.map((jobs) => Arr.filter(jobs, (job) => job.name === CONSUME_RUN))
    );

/** Sets the read time of every inbox row, as the Person reading them does. */
const markRowsRead = (fixture: Fixture, readAt: number) =>
  Effect.gen(function* () {
    const rows = yield* storedRows(fixture);
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        Effect.forEach(
          rows,
          (row) => writer.table("notifications").patch(row._id, { readAt }),
          { discard: true }
        )
      )
    );
  });

/**
 * Invites the fixture's Person, lets the inbox write the row, has the Person read
 * that row, and resends the invitation. Returns the invitation.
 */
const invitedReadAndResent = (fixture: Fixture) =>
  Effect.gen(function* () {
    const made = yield* inviteAt(fixture, "nf", fixture.invited, GURU);
    yield* consumeSchool(fixture, fixture.tenants.nf);
    yield* markRowsRead(fixture, NOW + 1);
    yield* fixture.as("admin").mutation(resend, {
      inviteId: made.id,
      locale: "id",
      slug: nf,
    });
    yield* consumeSchool(fixture, fixture.tenants.nf);
    return made;
  });

/** Sends every journal cursor back to the start of time, so the next run reads the same entries again. */
const rewindCursors = (fixture: Fixture) =>
  Effect.gen(function* () {
    const found = yield* cursors(fixture);
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        Effect.forEach(
          found,
          (cursor) =>
            writer
              .table("journalCursors")
              .patch(cursor._id, { pending: true, read: [], since: 0 }),
          { discard: true }
        )
      )
    );
  });

describe("notifications/consume run", () => {
  it.effect(
    "writes one row for an invited Person and moves the cursor to the end of the journal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        expect(yield* storedRows(fixture)).toEqual([]);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        const rows = yield* storedRows(fixture);
        expect(rows).toEqual([
          {
            _creationTime: expect.any(Number),
            _id: expect.any(String),
            changeType: "person.invited",
            createdAt: expect.any(Number),
            inviteId: made.id,
            journalEntryId: expect.any(String),
            recipientPersonId: fixture.invited,
            subject: { id: fixture.invited, kind: "person" },
            tenantId: fixture.tenants.nf,
          },
        ]);
        const [entry] = yield* fixture.run(journal);
        expect(entry).toMatchObject({
          change: { invite: made.id, type: "person.invited" },
        });
        expect(rows[0]?.journalEntryId).toBe(entry?._id);
        expect(rows[0]?.createdAt).toBe(entry?._creationTime);
        expect(yield* cursors(fixture)).toEqual([
          {
            _creationTime: expect.any(Number),
            _id: expect.any(String),
            changeType: "person.invited",
            consumer: "inbox",
            pending: false,
            read: [entry?._id],
            since: entry?._creationTime,
            tenantId: fixture.tenants.nf,
          },
        ]);
      })
  );

  it.effect(
    "reads no invitation that was recorded before its cursor started",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // An invitation recorded before the inbox existed: its entry has no cursor yet.
        const earlier = yield* fixture.run(
          invitePerson(fixture.tenants.nf, lain)
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("journalEntries").insert({
              actor: { kind: "system" },
              change: { invite: earlier.inviteId, type: "person.invited" },
              owner: { kind: "tenant", tenantId: fixture.tenants.nf },
              subject: { id: earlier.personId, kind: "person" },
            })
          )
        );
        // The school's first invitation creates the cursor a minute later.
        vi.setSystemTime(NOW + 60_000);
        yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.recipientPersonId)
        ).toEqual([fixture.invited]);
      })
  );

  it.effect(
    "writes no row for a Person whose account was released before the run",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        const account = yield* fixture.account("guru", GURU, true);
        yield* claim(fixture, fixture.invited, account.userId);
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("users").get(account.userId).pipe(Effect.orDie)
          )
        );
        yield* fixture.run(releaseTenantPeople(user, NOW + 1));
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toEqual([]);
        expect(
          yield* fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader
                .table("tenantPeople")
                .get(fixture.invited)
                .pipe(Effect.orDie)
            )
          )
        ).toMatchObject({ account: { state: "unclaimed" }, status: "active" });
      })
  );

  it.effect("writes no duplicate when a run reads the same entries again", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteAt(fixture, "nf", fixture.invited, GURU);
      yield* consumeSchool(fixture, fixture.tenants.nf);
      const before = yield* storedRows(fixture);
      yield* rewindCursors(fixture);
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* storedRows(fixture)).toEqual(before);
    })
  );

  it.effect("keeps its place when a run finds no new entry", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteAt(fixture, "nf", fixture.invited, GURU);
      yield* consumeSchool(fixture, fixture.tenants.nf);
      const before = yield* cursors(fixture);
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* cursors(fixture)).toEqual(before);
    })
  );

  it.effect(
    "starts a new cursor at the entry that creates it, not at the clock",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // An invitation recorded before any cursor exists, as one from before the inbox.
        const earlier = yield* fixture.run(
          invitePerson(fixture.tenants.nf, lain)
        );
        const entryId = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("journalEntries").insert({
              actor: { kind: "system" },
              change: { invite: earlier.inviteId, type: "person.invited" },
              owner: { kind: "tenant", tenantId: fixture.tenants.nf },
              subject: { id: earlier.personId, kind: "person" },
            })
          )
        );
        // The clock is a minute past the entry when the first cursor is made.
        vi.setSystemTime(NOW + 60_000);
        yield* fixture.run(noteInvite(fixture.tenants.nf, entryId));
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(
          Arr.map(yield* storedRows(fixture), (row) => row.recipientPersonId)
        ).toEqual([earlier.personId]);
      })
  );

  it.effect(
    "refreshes a resent invitation's row: one row, unread, at the resend's time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* invitedReadAndResent(fixture);
        const invited = Arr.filter(
          yield* fixture.run(journal),
          (entry) => entry.change.type === "person.invited"
        );
        expect(invited).toHaveLength(2);
        // The first entry is the invitation, and the second is its resend.
        const [, resent] = invited;
        const rows = yield* storedRows(fixture);
        expect(rows).toEqual([
          {
            _creationTime: expect.any(Number),
            _id: expect.any(String),
            changeType: "person.invited",
            createdAt: resent?._creationTime,
            inviteId: expect.any(String),
            journalEntryId: resent?._id,
            recipientPersonId: fixture.invited,
            subject: { id: fixture.invited, kind: "person" },
            tenantId: fixture.tenants.nf,
          },
        ]);
        expect(rows[0]).not.toHaveProperty("readAt");
      })
  );

  it.effect(
    "writes nothing new when a run reads a resent invitation's entries again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* invitedReadAndResent(fixture);
        // The Person reads the refreshed row, and a run then reads both entries again.
        yield* markRowsRead(fixture, NOW + 2);
        const before = yield* storedRows(fixture);
        yield* rewindCursors(fixture);
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toEqual(before);
      })
  );

  it.effect(
    "writes no row for an invitation revoked before its run reads it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        yield* fixture.as("admin").mutation(revoke, {
          inviteId: made.id,
          slug: nf,
        });
        yield* consumeSchool(fixture, fixture.tenants.nf);
        expect(yield* storedRows(fixture)).toEqual([]);
        expect(yield* cursors(fixture)).toMatchObject([{ pending: false }]);
      })
  );

  it.effect(
    "reads a school's invitations a page at a time, each once and in journal order",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const people = yield* Effect.all([
          addPerson(fixture, fixture.tenants.nf, "Satu"),
          addPerson(fixture, fixture.tenants.nf, "Dua"),
          addPerson(fixture, fixture.tenants.nf, "Tiga"),
        ]);
        // The three invitations share one creation time, so the order of the
        // pages rests on the index tie-break, and the cursor must resume inside it.
        yield* Effect.forEach(
          people,
          (personId, index) =>
            inviteAt(
              fixture,
              "nf",
              personId,
              `orang${index}@harapan.example.test`
            ),
          { discard: true }
        );
        const entries = yield* fixture.run(journal);
        expect(entries).toHaveLength(3);
        yield* fixture.run(consumeInboxPage(fixture.tenants.nf, 2));
        expect(yield* storedRows(fixture)).toHaveLength(2);
        yield* fixture.run(consumeInboxPage(fixture.tenants.nf, 2));
        const rows = yield* storedRows(fixture);
        expect(Arr.map(rows, (row) => row.journalEntryId)).toEqual(
          Arr.map(entries, (entry) => entry._id)
        );
        expect(Arr.map(rows, (row) => row.recipientPersonId)).toEqual(people);
        expect(
          Arr.dedupe(Arr.map(rows, (row) => row.recipientPersonId))
        ).toHaveLength(3);
        expect(
          Arr.sort(
            Arr.map(rows, (row) => row.recipientPersonId),
            Order.String
          )
        ).toEqual(Arr.sort(people, Order.String));
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
        { pending: false, read: [expect.any(String)] },
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

  it.effect(
    "marks the cursor pending and starts one run when an invite is written",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        expect(yield* cursors(fixture)).toMatchObject([
          { pending: true, read: [] },
        ]);
        expect(yield* runs(fixture)).toHaveLength(1);
      })
  );
});

describe("notifications/consume sweep", () => {
  it.effect(
    "starts a run for each school whose cursor a change left pending",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* inviteAt(fixture, "nf", fixture.invited, GURU);
        const before = yield* runs(fixture);
        yield* fixture.internal.mutation(sweep, {});
        expect(yield* runs(fixture)).toHaveLength(before.length + 1);
      })
  );

  it.effect("starts nothing for a school with no pending work", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteAt(fixture, "nf", fixture.invited, GURU);
      yield* consumeSchool(fixture, fixture.tenants.nf);
      const before = yield* runs(fixture);
      yield* fixture.internal.mutation(sweep, {});
      expect(yield* runs(fixture)).toHaveLength(before.length);
    })
  );
});
