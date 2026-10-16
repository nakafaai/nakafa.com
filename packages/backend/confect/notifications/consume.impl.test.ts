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
            position: expect.any(String),
            since: NOW,
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
      const [cursor] = yield* cursors(fixture);
      expect(cursor).toBeDefined();
      if (cursor === undefined) {
        return;
      }
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("journalCursors")
            .patch(cursor._id, { pending: true, position: null })
        )
      );
      yield* consumeSchool(fixture, fixture.tenants.nf);
      expect(yield* storedRows(fixture)).toHaveLength(1);
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
        { pending: false, position: expect.any(String) },
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
      yield* fixture.run(
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
      yield* fixture.run(noteInvite(fixture.tenants.nf));
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
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("journalEntries").insert({
            actor: { kind: "system" },
            change: { invite: inviteId, type: "person.invited" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: fixture.units.sma, kind: "unit" },
          })
        )
      );
      yield* fixture.run(noteInvite(fixture.tenants.nf));
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
          { pending: true, position: null },
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
