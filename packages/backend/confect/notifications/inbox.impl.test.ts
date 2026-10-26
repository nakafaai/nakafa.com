import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { HELD_SCHOOL_LIMIT } from "@repo/backend/confect/notifications/held";
import {
  addPerson,
  claim,
  claimedPersons,
  consumeSchool,
  insertRows,
  inviteAt,
  NOW,
  storedRows,
} from "@repo/backend/test/inbox";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { list, read, readAll } = refs.public.notifications.inbox;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };
const ANA = "ana@harapan.example.test";

/** Fake timers keep the clock where each test sets it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("notifications/inbox list", () => {
  it.effect(
    "lists the rows of every school the account holds, newest first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const budi = yield* fixture.account(
          "budi",
          "budi@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const anaOther = yield* addPerson(
          fixture,
          fixture.tenants.other,
          "Ana"
        );
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
              createdAt: expect.any(Number),
              subject: { id: anaOther, kind: "person" },
              tenant: { name: "Sekolah Lain", slug: "other", status: "active" },
            },
            {
              changeType: "person.invited",
              createdAt: expect.any(Number),
              subject: { id: anaNf, kind: "person" },
              tenant: { name: "Yayasan Nakafa", slug: "nf", status: "active" },
            },
          ],
        });
        expect(page.page[0]?.createdAt).toBeGreaterThan(
          page.page[1]?.createdAt ?? Number.NaN
        );
        expect(Arr.map(page.page, (item) => item.subject)).not.toContainEqual({
          id: budiNf,
          kind: "person",
        });
      })
  );

  it.effect("pages the rows, and continues after the last row shown", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account(
        "ana",
        "ana@harapan.example.test",
        true
      );
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
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const anaOther = yield* addPerson(
          fixture,
          fixture.tenants.other,
          "Ana"
        );
        yield* claim(fixture, anaNf, ana.userId);
        yield* claim(fixture, anaOther, ana.userId);
        const made = yield* inviteAt(
          fixture,
          "nf",
          fixture.invited,
          "satu@harapan.example.test"
        );
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return yield* Effect.die(
            "The invite must have written a journal entry."
          );
        }
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.all([
              writer.table("notifications").insert({
                changeType: "person.invited",
                createdAt: NOW,
                inviteId: made.id,
                journalEntryId: entry._id,
                recipientPersonId: anaNf,
                subject: { id: anaNf, kind: "person" },
                tenantId: fixture.tenants.nf,
              }),
              writer.table("notifications").insert({
                changeType: "person.invited",
                createdAt: NOW,
                inviteId: made.id,
                journalEntryId: entry._id,
                recipientPersonId: anaOther,
                subject: { id: anaOther, kind: "person" },
                tenantId: fixture.tenants.other,
              }),
            ])
          )
        );
        const rows = yield* storedRows(fixture);
        expect(Arr.dedupe(Arr.map(rows, (row) => row.createdAt))).toEqual([
          NOW,
        ]);
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

  it.effect(
    "orders rows that share one creation time the same way at every page size",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
        const made = yield* inviteAt(fixture, "nf", anaNf, ANA);
        yield* claim(fixture, anaNf, ana.userId);
        const [entry] = yield* fixture.run(journal);
        if (entry === undefined) {
          return yield* Effect.die(
            "The invite must have written a journal entry."
          );
        }
        // Three rows at one creation time, inserted in this order.
        const inserted = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(3, (index) => index),
              () =>
                writer.table("notifications").insert({
                  changeType: "person.invited",
                  createdAt: NOW,
                  inviteId: made.id,
                  journalEntryId: entry._id,
                  recipientPersonId: anaNf,
                  subject: { id: anaNf, kind: "person" },
                  tenantId: fixture.tenants.nf,
                })
            )
          )
        );
        const whole = yield* ana.client.query(list, {
          paginationOpts: { cursor: null, numItems: 3 },
        });
        const first = yield* ana.client.query(list, {
          paginationOpts: { cursor: null, numItems: 1 },
        });
        const second = yield* ana.client.query(list, {
          paginationOpts: { cursor: first.continueCursor, numItems: 1 },
        });
        const third = yield* ana.client.query(list, {
          paginationOpts: { cursor: second.continueCursor, numItems: 1 },
        });
        expect(third.isDone).toBe(true);
        const oneByOne = Arr.flatMap(
          [first, second, third],
          (page) => page.page
        );
        expect(Arr.map(oneByOne, (item) => item.id)).toEqual(
          Arr.map(whole.page, (item) => item.id)
        );
        expect(Arr.map(whole.page, (item) => item.id)).toEqual(
          Arr.reverse(inserted)
        );
      })
  );

  it.effect(
    "refuses an account that holds more Persons than one request reads, rather than showing some of its rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        yield* claimedPersons(fixture, ana.userId, HELD_SCHOOL_LIMIT + 1);
        const refusedList = yield* ana.client
          .query(list, firstPage)
          .pipe(Effect.flip);
        expect(refusedList).toMatchObject({
          _tag: "NotificationScopeTooLarge",
        });
        const refusedReadAll = yield* ana.client
          .mutation(readAll, {})
          .pipe(Effect.flip);
        expect(refusedReadAll).toMatchObject({
          _tag: "NotificationScopeTooLarge",
        });
      })
  );

  it.effect("refuses a page cursor that the list did not return", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account(
        "ana",
        "ana@harapan.example.test",
        true
      );
      const refused = yield* ana.client
        .query(list, {
          paginationOpts: { cursor: "not a cursor", numItems: 1 },
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotificationCursorInvalid" });
    })
  );

  it.effect("refuses a caller without a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture.anonymous
        .query(list, firstPage)
        .pipe(Effect.flip);
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
      const ana = yield* fixture.account(
        "ana",
        "ana@harapan.example.test",
        true
      );
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const first = yield* ana.client.query(list, firstPage);
      const after = yield* ana.client.query(list, {
        paginationOpts: { cursor: first.continueCursor, numItems: 10 },
      });
      expect(after).toMatchObject({ isDone: true, page: [] });
      expect(after.continueCursor).toBe(first.continueCursor);
    })
  );
});

describe("notifications/inbox read", () => {
  it.effect("marks one row read at the moment of the first read only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account(
        "ana",
        "ana@harapan.example.test",
        true
      );
      const anaNf = yield* addPerson(fixture, fixture.tenants.nf, "Ana");
      yield* inviteAt(fixture, "nf", anaNf, "ana@harapan.example.test");
      yield* consumeSchool(fixture, fixture.tenants.nf);
      yield* claim(fixture, anaNf, ana.userId);
      const row = yield* Effect.fromOption(
        Arr.head((yield* ana.client.query(list, firstPage)).page)
      );
      expect(row).not.toHaveProperty("readAt");
      vi.setSystemTime(NOW + 5000);
      const firstRead = yield* ana.client.mutation(read, {
        notificationId: row.id,
      });
      expect(firstRead).toMatchObject({ id: row.id, readAt: NOW + 5000 });
      vi.setSystemTime(NOW + 9000);
      const secondRead = yield* ana.client.mutation(read, {
        notificationId: row.id,
      });
      expect(secondRead).toMatchObject({ id: row.id, readAt: NOW + 5000 });
    })
  );

  it.effect(
    "refuses a row that belongs to a Person another account holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const budi = yield* fixture.account(
          "budi",
          "budi@harapan.example.test",
          true
        );
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
        const [stored] = yield* storedRows(fixture);
        expect(stored?.recipientPersonId).toBe(anaNf);
        expect(stored?.readAt).toBeUndefined();
      })
  );

  it.effect("refuses a row of a Person the account no longer holds", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const ana = yield* fixture.account(
        "ana",
        "ana@harapan.example.test",
        true
      );
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
      yield* insertRows(
        fixture,
        fixture.people.suspended.personId,
        fixture.tenants.nf,
        1
      );
      const row = yield* Effect.fromOption(
        Arr.head(yield* storedRows(fixture))
      );
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
      const row = yield* Effect.fromOption(
        Arr.head(yield* storedRows(fixture))
      );
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
      yield* insertRows(
        fixture,
        fixture.people.admin.personId,
        fixture.tenants.nf,
        1
      );
      const row = yield* Effect.fromOption(
        Arr.head(yield* storedRows(fixture))
      );
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
