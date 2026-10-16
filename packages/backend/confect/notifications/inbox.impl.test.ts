import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
const nf = slugOf("nf");
const other = slugOf("other");
const { invite } = refs.public.tenancy.invites;
const { list, read, readAll } = refs.public.notifications.inbox;
const consume = refs.internal.notifications.consume.run;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** Fake timers keep the clock where each test sets it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

type Fixture = Effect.Success<typeof tenancyFixture>;
type PersonId = GenericId.GenericId<"tenantPeople">;
type UserId = GenericId.GenericId<"users">;
type TenantId = GenericId.GenericId<"tenants">;

const address = (value: string) => Schema.decodeSync(Email)(value);

/** Adds an unclaimed, active Person to a school. */
const addPerson = (fixture: Fixture, tenantId: TenantId, name: string) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId,
      })
    )
  );

/** Invites a Person as the Admin of `nf` or the Owner of `other`. */
const inviteAt = (
  fixture: Fixture,
  school: "nf" | "other",
  personId: PersonId,
  mail: string
) =>
  fixture.as(school === "nf" ? "admin" : "otherOwner").mutation(invite, {
    email: address(mail),
    locale: "id",
    personId,
    slug: school === "nf" ? nf : other,
  });

/** Gives a Person to an account, as a claim does. */
const claim = (fixture: Fixture, personId: PersonId, userId: UserId) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").patch(personId, {
        account: {
          claimedAt: NOW,
          method: "invite",
          state: "claimed",
          userId,
        },
      })
    )
  );

/** Runs the inbox consumer of one school to its end. */
const consumeSchool = (fixture: Fixture, tenantId: TenantId) =>
  fixture.internal.mutation(consume, { tenantId });

/** Every row of the inbox, oldest first, as the table stores it. */
const storedRows = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("notifications").index("by_creation_time").take(200)
    )
  );

/**
 * Inserts inbox rows for one Person straight into the table. An invite of the
 * fixture's unclaimed Person first makes the journal entry the rows refer to.
 */
const insertRows = (
  fixture: Fixture,
  personId: PersonId,
  tenantId: TenantId,
  count: number
) =>
  Effect.gen(function* () {
    yield* inviteAt(fixture, "nf", fixture.invited, "satu@harapan.example.test");
    const [entry] = yield* fixture.run(journal);
    if (entry === undefined) {
      return yield* Effect.die("The invite must have written a journal entry.");
    }
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        Effect.forEach(
          Arr.makeBy(count, (index) => index),
          (index) =>
            writer.table("notifications").insert({
              changeType: "person.invited",
              createdAt: NOW - index,
              journalEntryId: entry._id,
              recipientPersonId: personId,
              subject: { id: personId, kind: "person" },
              tenantId,
            }),
          { discard: true }
        )
      )
    );
  });

describe("notifications/inbox list", () => {
  it.effect("lists the rows of every school the account holds, newest first", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const budi = yield* fixture.account("budi", "budi@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      const anaOther = yield* addPerson(fixture, fixture.tenants.other, "Ana");
      const budiNf = yield* addPerson(fixture, fixture.tenants.nf, "Budi");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      vi.setSystemTime(NOW + 1000);
      yield* inviteAt(fixture, "other", anaOther, "ana@harapan.example.test");
      vi.setSystemTime(NOW + 2000);
      yield* inviteAt(fixture, "nf", budiNf, "budi@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* consumeSchool(fixture, fixture.tenants.other);
      yield* claim(fixture, anaNf, ana.userId);
      yield* claim(fixture, anaOther, ana.userId);
      yield* claim(fixture, budiNf, budi.userId);
      const page = yield* ana.client.query(list, firstPage);
      expect(page).toMatchObject({
        isDone: true,
        page: [
          {
            changeType: "person.invited",
            createdAt: NOW + 1000,
            subject: { id: anaOther, kind: "person" },
            tenant: { name: "Sekolah Lain", slug: "other", status: "active" },
          },
          {
            changeType: "person.invited",
            createdAt: NOW,
            subject: { id: anaNf, kind: "person" },
            tenant: { name: "Yayasan Nakafa", slug: "nf", status: "active" },
          },
        ],
      });
      expect(Arr.map(page.page, (item) => item.subject)).not.toContainEqual({
        id: budiNf,
        kind: "person",
      });
    })
  );

  it.effect("pages the rows, and continues after the last row shown", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      const anaOther = yield* addPerson(fixture, fixture.tenants.other, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      vi.setSystemTime(NOW + 1000);
      yield* inviteAt(fixture, "other", anaOther, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* consumeSchool(fixture, fixture.tenants.other);
      yield* claim(fixture, anaNf, ana.userId);
      yield* claim(fixture, anaOther, ana.userId);
      const first = yield* ana.client.query(list, {
        paginationOpts: { cursor: null, numItems: 1 },
      });
      expect(first).toMatchObject({
        isDone: false,
        page: [{ subject: { id: anaOther, kind: "person" } }],
      });
      const second = yield* ana.client.query(list, {
        paginationOpts: { cursor: first.continueCursor, numItems: 1 },
      });
      expect(second).toMatchObject({
        isDone: true,
        page: [{ subject: { id: anaNf, kind: "person" } }],
      });
    })
  );

  it.effect(
    "shows each row once across pages when rows share one creation time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const anaOther = yield* addPerson(fixture, fixture.tenants.other, "Ana");
        yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
        yield* inviteAt(fixture, "other", anaOther, "ana@harapan.example.test");
        yield* consumeSchool(fixture, fixture.tenants.nf);
        yield* consumeSchool(fixture, fixture.tenants.other);
        yield* claim(fixture, anaNf, ana.userId);
        yield* claim(fixture, anaOther, ana.userId);
        const rows = yield* storedRows(fixture);
        expect(Arr.dedupe(Arr.map(rows, (row) => row.createdAt))).toEqual([NOW]);
        const first = yield* ana.client.query(list, {
          paginationOpts: { cursor: null, numItems: 1 },
        });
        const second = yield* ana.client.query(list, {
          paginationOpts: { cursor: first.continueCursor, numItems: 1 },
        });
        expect(second.isDone).toBe(true);
        const subjects = Arr.map(
          Arr.appendAll(first.page, second.page),
          (item) => item.subject
        );
        expect(subjects).toHaveLength(2);
        expect(subjects).toEqual(
          expect.arrayContaining([
            { id: anaNf, kind: "person" },
            { id: anaOther, kind: "person" },
          ])
        );
      })
  );

  it.effect("lists every Person of an account, across more than one page of them", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const many = yield* Effect.forEach(
        Arr.makeBy(51, (index) => index),
        (index) => addPerson(fixture, fixture.tenants.nf, `Orang ${index}`),
        { concurrency: 1 }
      );
      yield* Effect.forEach(many, (personId) => claim(fixture, personId, ana.userId), {
        discard: true,
      });
      const last = yield* Effect.fromOption(Arr.last(many));
      yield* insertRows(fixture, last, fixture.tenants.nf, 1);
      const page = yield* ana.client.query(list, firstPage);
      expect(page).toMatchObject({
        isDone: true,
        page: [{ subject: { id: last, kind: "person" } }],
      });
    })
  );

  it.effect("refuses a page cursor that the list did not return", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const refused = yield* ana.client
        .query(list, { paginationOpts: { cursor: "not a cursor", numItems: 1 } })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationCursorInvalid" });
    })
  );

  it.effect("refuses a caller without a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture.anonymous.query(list, firstPage).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "SessionRequired" });
    })
  );

  it.effect("shows an account with no school nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const page = yield* fixture.as("stranger").query(list, firstPage);
      expect(page).toEqual({ continueCursor: "", isDone: true, page: [] });
    })
  );

  it.effect("keeps the cursor of a page that holds no more rows", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const first = yield* ana.client.query(list, firstPage);
      const after = yield* ana.client.query(list, {
        paginationOpts: { cursor: first.continueCursor, numItems: 10 },
      });
      expect(after).toMatchObject({ isDone: true, page: [] });
      expect(after.continueCursor).toEqual(expect.any(String));
    })
  );
});

describe("notifications/inbox read", () => {
  it.effect("marks one row read at the moment of the first read only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const row = yield* Effect.fromOption(
        Arr.head((yield* ana.client.query(list, firstPage)).page)
      );
      expect(row).not.toHaveProperty("readAt");
      vi.setSystemTime(NOW + 5000);
      const firstRead = yield* ana.client.mutation(read, { notificationId: row.id });
      expect(firstRead).toMatchObject({ id: row.id, readAt: NOW + 5000 });
      vi.setSystemTime(NOW + 9000);
      const secondRead = yield* ana.client.mutation(read, { notificationId: row.id });
      expect(secondRead).toMatchObject({ id: row.id, readAt: NOW + 5000 });
    })
  );

  it.effect("refuses a row that belongs to a Person another account holds", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const budi = yield* fixture.account("budi", "budi@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const row = yield* Effect.fromOption(
        Arr.head((yield* ana.client.query(list, firstPage)).page)
      );
      const refused = yield* budi.client
        .mutation(read, { notificationId: row.id })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationNotFound" });
      expect(yield* storedRows(fixture)).toMatchObject([
        { readAt: undefined, recipientPersonId: anaNf },
      ]);
    })
  );

  it.effect("refuses a row of a Person the account no longer holds", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const row = yield* Effect.fromOption(
        Arr.head((yield* ana.client.query(list, firstPage)).page)
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeople").patch(anaNf, {
            account: { state: "unclaimed" },
          })
        )
      );
      const refused = yield* ana.client
        .mutation(read, { notificationId: row.id })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationNotFound" });
    })
  );

  it.effect("refuses a row of a Person whose status is not active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* insertRows(fixture, fixture.people.suspended.personId, fixture.tenants.nf, 1);
      const row = yield* Effect.fromOption(Arr.head(yield* storedRows(fixture)));
      const refused = yield* fixture
        .as("suspended")
        .mutation(read, { notificationId: row._id })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationNotFound" });
    })
  );

  it.effect("refuses a row of an operator Person", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* insertRows(fixture, fixture.visitor, fixture.tenants.nf, 1);
      const row = yield* Effect.fromOption(Arr.head(yield* storedRows(fixture)));
      const refused = yield* fixture
        .as("visitor")
        .mutation(read, { notificationId: row._id })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationNotFound" });
    })
  );

  it.effect("refuses a row that has been deleted", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* insertRows(fixture, fixture.people.admin.personId, fixture.tenants.nf, 1);
      const row = yield* Effect.fromOption(Arr.head(yield* storedRows(fixture)));
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("notifications").delete(row._id)
        )
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(read, { notificationId: row._id })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationNotFound" });
    })
  );
});

describe("notifications/inbox readAll", () => {
  it.effect("marks the account's unread rows read, and no other account's rows", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const budi = yield* fixture.account("budi", "budi@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      const budiNf = yield* addPerson(fixture, fixture.tenants.nf, "Budi");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* inviteAt(fixture, "nf", budiNf, "budi@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      yield* claim(fixture, budiNf, budi.userId);
      const readAtsOf = (personId: PersonId) =>
        storedRows(fixture).pipe(
          Effect.map((rows) =>
            Arr.map(
              Arr.filter(rows, (row) => row.recipientPersonId === personId),
              (row) => row.readAt
            )
          )
        );
      vi.setSystemTime(NOW + 4000);
      yield* ana.client.mutation(readAll, {});
      expect(yield* readAtsOf(anaNf)).toEqual([NOW + 4000]);
      expect(yield* readAtsOf(budiNf)).toEqual([undefined]);
      vi.setSystemTime(NOW + 8000);
      yield* ana.client.mutation(readAll, {});
      expect(yield* readAtsOf(anaNf)).toEqual([NOW + 4000]);
    })
  );

  it.effect("marks the rows of an account read beyond one page of them", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account("ana", "ana@harapan.example.test", true);
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* claim(fixture, anaNf, ana.userId);
      yield* insertRows(fixture, anaNf, fixture.tenants.nf, 51);
      vi.setSystemTime(NOW + 4000);
      yield* ana.client.mutation(readAll, {});
      const rows = Arr.filter(
        yield* storedRows(fixture),
        (row) => row.recipientPersonId === anaNf
      );
      expect(rows).toHaveLength(51);
      expect(Arr.every(rows, (row) => row.readAt === NOW + 4000)).toBe(true);
    })
  );

  it.effect("refuses a caller without a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture.anonymous
        .mutation(readAll, {})
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "SessionRequired" });
    })
  );
});
