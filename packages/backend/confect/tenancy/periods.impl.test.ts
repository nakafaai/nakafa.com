import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const { archive, create, list, open, rename } = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** The terms of the school SMA, which keeps the Asia/Jakarta clock. */
const SMA_TERMS = {
  end: "2026-12-19",
  name: "Ganjil 2026/2027",
  start: "2026-07-13",
};

type Fixture = Effect.Success<typeof tenancyFixture>;
type Account = Parameters<Fixture["as"]>[0];

/** Creates one period in a school, as one of the seeded accounts. */
const createAs = (
  fixture: Fixture,
  account: Account,
  unitId: GenericId.GenericId<"tenantUnits">,
  term: { end: string; name: string; start: string }
) =>
  fixture.as(account).mutation(create, {
    ...term,
    slug: nf,
    unitId,
  });

/** Creates one period as the school's Admin, and returns the period the mutation made. */
const admin = (
  fixture: Fixture,
  term: { end: string; name: string; start: string }
) => createAs(fixture, "admin", fixture.units.sma, term);

describe("tenancy/periods create", () => {
  it.effect(
    "creates a planned period on the school's clock, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        expect(period).toEqual({
          end: "2026-12-19",
          id: expect.any(String),
          name: "Ganjil 2026/2027",
          start: "2026-07-13",
          status: "planned",
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "period.created" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: period.id, kind: "period" },
          },
        ]);
      })
  );

  it.effect("keeps a year-boundary date unchanged on any school clock", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const kiritimati = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantUnits").insert({
            contentLanguage: "id",
            level: "smp",
            name: "SMP Kiritimati",
            status: "active",
            tenantId: fixture.tenants.nf,
            timeZone: "Pacific/Kiritimati",
          })
        )
      );
      const jakarta = yield* admin(fixture, {
        end: "2027-01-02",
        name: "Jakarta",
        start: "2026-12-31",
      });
      const kiritimatiPeriod = yield* createAs(fixture, "admin", kiritimati, {
        end: "2027-01-02",
        name: "Kiritimati",
        start: "2026-12-31",
      });
      expect([jakarta, kiritimatiPeriod]).toMatchObject([
        { end: "2027-01-02", start: "2026-12-31" },
        { end: "2027-01-02", start: "2026-12-31" },
      ]);
    })
  );

  it.effect("refuses dates the calendar does not have or cannot order", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refusals = yield* Effect.all(
        Arr.map(
          [
            { end: "2026-12-19", start: "2026-02-30" },
            { end: "2026-7-19", start: "2026-07-13" },
            { end: "2026-07-13", start: "2026-07-13" },
            { end: "2026-07-01", start: "2026-07-13" },
          ],
          (dates) =>
            admin(fixture, { ...dates, name: "Salah" }).pipe(Effect.flip)
        )
      );
      expect(refusals).toMatchObject([
        { _tag: "PeriodDatesInvalid" },
        { _tag: "PeriodDatesInvalid" },
        { _tag: "PeriodDatesInvalid" },
        { _tag: "PeriodDatesInvalid" },
      ]);
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("refuses a period that shares a day with another period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* admin(fixture, {
        end: "2026-12-31",
        name: "Ganjil",
        start: "2026-07-01",
      });
      const overlaps = yield* Effect.all(
        Arr.map(
          [
            { end: "2027-01-10", start: "2026-12-31" },
            { end: "2026-07-01", start: "2026-06-01" },
            { end: "2027-06-30", start: "2026-08-01" },
          ],
          (dates) =>
            admin(fixture, { ...dates, name: "Tumpang" }).pipe(Effect.flip)
        )
      );
      expect(overlaps).toMatchObject([
        { _tag: "PeriodOverlaps" },
        { _tag: "PeriodOverlaps" },
        { _tag: "PeriodOverlaps" },
      ]);
      yield* admin(fixture, {
        end: "2026-06-30",
        name: "Sebelum",
        start: "2026-06-01",
      });
      yield* admin(fixture, {
        end: "2027-06-30",
        name: "Sesudah",
        start: "2027-01-01",
      });
      const names = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, slug: nf, unitId: fixture.units.sma });
      expect(Arr.map(names.page, (period) => period.name)).toEqual([
        "Sesudah",
        "Ganjil",
        "Sebelum",
      ]);
    })
  );

  it.effect("refuses a new period while the school is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(suspend(fixture.tenants.nf));
      const refusal = yield* admin(fixture, SMA_TERMS).pipe(Effect.flip);
      expect(refusal).toMatchObject(denied("condition"));
    })
  );
});

describe("tenancy/periods open and archive", () => {
  it.effect(
    "opens a planned period, refuses while another is active, and archives",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* admin(fixture, SMA_TERMS);
        const second = yield* admin(fixture, {
          end: "2027-06-30",
          name: "Genap 2026/2027",
          start: "2027-01-04",
        });
        const opened = yield* fixture
          .as("admin")
          .mutation(open, { periodId: first.id, slug: nf });
        const blocked = yield* fixture
          .as("admin")
          .mutation(open, { periodId: second.id, slug: nf })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("admin")
          .mutation(archive, { periodId: first.id, slug: nf });
        const reopened = yield* fixture
          .as("admin")
          .mutation(open, { periodId: second.id, slug: nf });
        expect([
          opened.status,
          blocked,
          archived.status,
          reopened.status,
        ]).toMatchObject([
          "active",
          { _tag: "PeriodActive" },
          "archived",
          "active",
        ]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "period.created" } },
          { change: { type: "period.opened" } },
          { change: { type: "period.archived" } },
          { change: { type: "period.opened" } },
        ]);
      })
  );

  it.effect(
    "opening an active period changes nothing and records nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: period.id, slug: nf });
        const again = yield* fixture
          .as("admin")
          .mutation(open, { periodId: period.id, slug: nf });
        expect(again.status).toBe("active");
        expect(yield* fixture.run(journal)).toHaveLength(2);
      })
  );

  it.effect("archives only an active period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      const notActive = yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      expect(notActive).toMatchObject({ _tag: "PeriodNotActive" });
      yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf });
      yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf });
      const archivedAgain = yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      expect(archivedAgain).toMatchObject(denied("condition"));
    })
  );

  it.effect("an archived period and an archived school refuse writes", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf });
      yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf });
      const reopened = yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      const inArchivedSchool = yield* createAs(
        fixture,
        "admin",
        fixture.units.smk,
        SMA_TERMS
      ).pipe(Effect.flip);
      expect([reopened, inArchivedSchool]).toMatchObject([
        denied("condition"),
        denied("condition"),
      ]);
    })
  );
});

describe("tenancy/periods rename", () => {
  it.effect(
    "renames a period in place, answers the new name, and journals the rename",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const renamed = yield* fixture.as("admin").mutation(rename, {
          name: "Genap 2026/2027",
          periodId: period.id,
          slug: nf,
        });
        const entries = yield* fixture.run(journal);
        expect(renamed).toEqual({ ...period, name: "Genap 2026/2027" });
        expect(
          Arr.filter(entries, (entry) => entry.change.type === "period.rename")
        ).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "period.rename" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: period.id, kind: "period" },
          },
        ]);
      })
  );

  it.effect(
    "writes and records nothing for the name a period already has",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const before = yield* fixture.run(journal);
        const same = yield* fixture.as("admin").mutation(rename, {
          name: period.name,
          periodId: period.id,
          slug: nf,
        });
        expect(same).toEqual(period);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect("refuses a teacher, who does not hold period.manage", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      const denial = yield* fixture
        .as("teacher")
        .mutation(rename, { name: "Lain", periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("role"));
    })
  );

  it.effect("refuses to rename an archived period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf });
      yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf });
      const denial = yield* fixture
        .as("admin")
        .mutation(rename, { name: "Lain", periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("condition"));
    })
  );
});

describe("tenancy/periods archived school", () => {
  it.effect("refuses to open a planned period of an archived school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const planned = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Lama",
            start: "2026-07-13",
            status: "planned",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          })
        )
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(open, { periodId: planned, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("condition"));
    })
  );
});

describe("tenancy/periods roles and tenants", () => {
  it.effect(
    "lets the school's Admin write and its plan roles read, and refuses the rest",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owned = yield* createAs(
          fixture,
          "owner",
          fixture.units.sma,
          SMA_TERMS
        );
        const principal = yield* fixture
          .as("principal")
          .query(list, { ...firstPage, slug: nf, unitId: fixture.units.sma });
        const auditor = yield* fixture
          .as("auditor")
          .query(list, { ...firstPage, slug: nf, unitId: fixture.units.sma });
        const principalWrite = yield* createAs(
          fixture,
          "principal",
          fixture.units.sma,
          SMA_TERMS
        ).pipe(Effect.flip);
        const teacherRead = yield* fixture
          .as("teacher")
          .query(list, { ...firstPage, slug: nf, unitId: fixture.units.smp })
          .pipe(Effect.flip);
        const unitAdminElsewhere = yield* createAs(
          fixture,
          "unitAdmin",
          fixture.units.sma,
          SMA_TERMS
        ).pipe(Effect.flip);
        const unitAdminHere = yield* createAs(
          fixture,
          "unitAdmin",
          fixture.units.smp,
          SMA_TERMS
        );
        expect(owned.status).toBe("planned");
        expect(Arr.map(principal.page, (period) => period.id)).toEqual([
          owned.id,
        ]);
        expect(Arr.map(auditor.page, (period) => period.id)).toEqual([
          owned.id,
        ]);
        expect([principalWrite, teacherRead, unitAdminElsewhere]).toMatchObject(
          [denied("role"), denied("role"), denied("role")]
        );
        expect(unitAdminHere.status).toBe("planned");
      })
  );

  it.effect("refuses a student, and an Admin of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const student = yield* fixture
        .as("student")
        .query(list, { ...firstPage, slug: nf, unitId: fixture.units.smp })
        .pipe(Effect.flip);
      const elsewhere = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, slug: other, unitId: fixture.units.sd })
        .pipe(Effect.flip);
      const crossTenant = yield* fixture
        .as("admin")
        .mutation(create, {
          ...SMA_TERMS,
          slug: nf,
          unitId: fixture.units.sd,
        })
        .pipe(Effect.flip);
      expect([student, elsewhere, crossTenant]).toMatchObject([
        denied("role"),
        notMember,
        denied("resource"),
      ]);
    })
  );
});
