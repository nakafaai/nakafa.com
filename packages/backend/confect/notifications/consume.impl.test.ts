import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  consumeInboxPage,
  noteInvite,
} from "@repo/backend/confect/notifications/inbox";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
const nf = slugOf("nf");
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const lain = Schema.decodeSync(Email)("lain@lain.example.test");
const { invite } = refs.public.tenancy.invites;
const consume = refs.internal.notifications.consume.run;
const sweep = refs.internal.notifications.consume.sweep;
const CONSUME_RUN = "notifications/consume:run";

/** Fake timers keep every scheduled run from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

type Fixture = Effect.Success<typeof tenancyFixture>;
type PersonId = GenericId.GenericId<"tenantPeople">;

/** Adds an unclaimed, active Person to the first school of the fixture. */
const addPerson = (fixture: Fixture, name: string) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId: fixture.tenants.nf,
      })
    )
  );

/** Invites one Person to an address, as the Admin of the first school. */
const inviteInNf = (
  fixture: Fixture,
  personId: PersonId,
  address: typeof guru
) =>
  fixture.as("admin").mutation(invite, {
    email: address,
    locale: "id",
    personId,
    slug: nf,
  });

/** Every row of the inbox, oldest first. */
const notifications = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("notifications").index("by_creation_time").take(50)
    )
  );

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
        const made = yield* inviteInNf(fixture, fixture.invited, guru);
        expect(yield* notifications(fixture)).toEqual([]);
        yield* fixture.internal.mutation(consume, {
          tenantId: fixture.tenants.nf,
        });
        const rows = yield* notifications(fixture);
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
            tenantId: fixture.tenants.nf,
          },
        ]);
      })
  );

  it.effect("writes no duplicate when a run reads the same entries again", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteInNf(fixture, fixture.invited, guru);
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
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
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      expect(yield* notifications(fixture)).toHaveLength(1);
    })
  );

  it.effect(
    "reads a school's invitations a page at a time, each once and in journal order",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const people = yield* Effect.all([
          addPerson(fixture, "Satu"),
          addPerson(fixture, "Dua"),
          addPerson(fixture, "Tiga"),
        ]);
        yield* Effect.forEach(
          people,
          (personId, index) =>
            Effect.sync(() => vi.setSystemTime(NOW + index * 1000)).pipe(
              Effect.andThen(
                inviteInNf(
                  fixture,
                  personId,
                  Schema.decodeSync(Email)(`orang${index}@harapan.example.test`)
                )
              )
            ),
          { discard: true }
        );
        const entries = yield* fixture.run(journal);
        expect(entries).toHaveLength(3);
        yield* fixture.run(consumeInboxPage(fixture.tenants.nf, 2));
        expect(yield* notifications(fixture)).toHaveLength(2);
        yield* fixture.run(consumeInboxPage(fixture.tenants.nf, 2));
        const rows = yield* notifications(fixture);
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
      yield* inviteInNf(fixture, fixture.invited, guru);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantPeople")
            .patch(fixture.invited, { status: "removed" })
        )
      );
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      expect(yield* notifications(fixture)).toEqual([]);
      expect(yield* cursors(fixture)).toMatchObject([
        { pending: false, position: expect.any(String) },
      ]);
    })
  );

  it.effect("skips an entry whose Person no longer exists", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const gone = yield* addPerson(fixture, "Pergi");
      yield* inviteInNf(fixture, gone, guru);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeople").delete(gone)
        )
      );
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      expect(yield* notifications(fixture)).toEqual([]);
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
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      expect(yield* notifications(fixture)).toEqual([]);
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
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      expect(yield* notifications(fixture)).toEqual([]);
    })
  );

  it.effect("does nothing for a school that no invite has reached", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.other,
      });
      expect(yield* notifications(fixture)).toEqual([]);
      expect(yield* cursors(fixture)).toEqual([]);
    })
  );

  it.effect(
    "marks the cursor pending and starts one run when an invite is written",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* inviteInNf(fixture, fixture.invited, guru);
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
        yield* inviteInNf(fixture, fixture.invited, guru);
        const before = yield* runs(fixture);
        yield* fixture.internal.mutation(sweep, {});
        expect(yield* runs(fixture)).toHaveLength(before.length + 1);
      })
  );

  it.effect("starts nothing for a school with no pending work", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* inviteInNf(fixture, fixture.invited, guru);
      yield* fixture.internal.mutation(consume, {
        tenantId: fixture.tenants.nf,
      });
      const before = yield* runs(fixture);
      yield* fixture.internal.mutation(sweep, {});
      expect(yield* runs(fixture)).toHaveLength(before.length);
    })
  );
});
