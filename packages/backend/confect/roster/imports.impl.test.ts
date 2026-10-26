import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { cohort, denied, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool, NISN, setRoster } from "@repo/backend/test/guardians";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, Schema } from "effect";

const { apply, list } = refs.public.roster.imports;
const SECOND = Schema.decodeSync(Nisn)("0098765432");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The Person rows the school holds under one name. */
const peopleNamed = (name: string) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tenantPeople")
      .index("by_creation_time")
      .take(100)
      .pipe(Effect.map((rows) => Arr.filter(rows, (row) => row.name === name)))
  );

describe("roster/imports", () => {
  it.effect(
    "adds new students with a grant, a sealed NISN, and a placement by class group name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-A");
        const rows = [
          {
            cohortName: "vii-a",
            name: "Raka Pratama",
            nisn: NISN,
            underAgeLimit: true,
          },
          {
            cohortName: "IX-Z",
            name: "Sari Dewi",
            nisn: SECOND,
            underAgeLimit: false,
          },
        ];
        const summary = yield* fixture
          .as("counselor")
          .mutation(apply, { periodId: term.id, rows, slug: nf });
        expect(summary).toEqual({ added: 2, changed: 0, skipped: 0 });
        const [raka] = yield* fixture.run(peopleNamed("Raka Pratama"));
        const grants = yield* fixture.run(
          activeGrants(raka?._id ?? fixture.invited)
        );
        expect(Arr.map(grants, (grant) => grant.role.key)).toEqual(["student"]);
        expect(
          yield* fixture.as("admin").query(refs.public.roster.entries.get, {
            personId: raka?._id ?? fixture.invited,
            slug: nf,
          })
        ).toMatchObject({ hasNisn: true, underAgeLimit: true });
        const placements = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("tenantCohortMembers")
              .index("by_cohortId_and_personId", (query) =>
                query.eq("cohortId", x1.id)
              )
              .take(10)
          )
        );
        expect(Arr.map(placements, (row) => row.personId)).toEqual([raka?._id]);
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: {
            change: {
              added: 2,
              changed: 0,
              skipped: 0,
              source: "dapodik",
              type: "roster.imported",
            },
            subject: { id: term.id, kind: "period" },
          },
        });
      })
  );

  it.effect(
    "changes a student the roster names by NISN on a second run, and adds no duplicate",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        yield* cohort(fixture, term.id, "VII-A");
        yield* setRoster(fixture, { nisn: NISN, underAgeLimit: true });
        const row = {
          cohortName: "VII-A",
          name: "Nama Lain",
          nisn: NISN,
          underAgeLimit: false,
        };
        const first = yield* fixture
          .as("admin")
          .mutation(apply, { periodId: term.id, rows: [row], slug: nf });
        expect(first).toEqual({ added: 0, changed: 1, skipped: 0 });
        expect(yield* fixture.run(peopleNamed("Nama Lain"))).toEqual([]);
        expect(
          yield* fixture.as("admin").query(refs.public.roster.entries.get, {
            personId: fixture.people.student.personId,
            slug: nf,
          })
        ).toMatchObject({ underAgeLimit: false });
        // A second file without the class group column changes the row and moves no one.
        const again = yield* fixture.as("admin").mutation(apply, {
          periodId: term.id,
          rows: [{ name: row.name, nisn: NISN, underAgeLimit: false }],
          slug: nf,
        });
        expect(again).toEqual({ added: 0, changed: 1, skipped: 0 });
      })
  );

  it.effect("skips a student the school removed, and never reopens them", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const term = yield* period(fixture, fixture.units.smp);
      yield* setRoster(fixture, { nisn: NISN, underAgeLimit: true });
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantPeople")
            .patch(fixture.people.student.personId, { status: "removed" })
        )
      );
      expect(
        yield* fixture.as("admin").mutation(apply, {
          periodId: term.id,
          rows: [{ name: "Student", nisn: NISN, underAgeLimit: true }],
          slug: nf,
        })
      ).toEqual({ added: 0, changed: 0, skipped: 1 });
    })
  );

  it.effect("keeps the import to the school's Admin and Staff", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const term = yield* period(fixture, fixture.units.smp);
      const rows = [{ name: "Raka", nisn: NISN, underAgeLimit: true }];
      for (const account of ["teacher", "student"] as const) {
        expect(
          yield* Effect.flip(
            fixture
              .as(account)
              .mutation(apply, { periodId: term.id, rows, slug: nf })
          )
        ).toMatchObject(denied("role"));
      }
      expect(
        yield* Effect.flip(
          fixture.as("otherOwner").mutation(apply, {
            periodId: term.id,
            rows,
            slug: slugOf("other"),
          })
        )
      ).toMatchObject(denied("resource"));
    })
  );

  it.effect(
    "lists the period's placed students with the NISN on file for the export",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-A");
        yield* fixture.as("admin").mutation(apply, {
          periodId: term.id,
          rows: [
            {
              cohortName: "VII-A",
              name: "Raka Pratama",
              nisn: NISN,
              underAgeLimit: true,
            },
          ],
          slug: nf,
        });
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.placements.place, {
            cohortId: x1.id,
            personId: fixture.people.student.personId,
            slug: nf,
          });
        // A roster row that holds only the age flag exports no NISN.
        yield* setRoster(fixture, { underAgeLimit: true });
        const page = yield* fixture.as("counselor").query(list, {
          paginationOpts: { cursor: null, numItems: 10 },
          periodId: term.id,
          slug: nf,
        });
        expect(
          Arr.sort(
            Arr.map(
              page.page,
              (line) => `${line.name}:${line.nisn ?? "none"}:${line.cohortName}`
            ),
            Order.String
          )
        ).toEqual([`Raka Pratama:${NISN}:VII-A`, "Student:none:VII-A"]);
        expect(
          yield* Effect.flip(
            fixture.as("teacher").query(list, {
              paginationOpts: { cursor: null, numItems: 10 },
              periodId: term.id,
              slug: nf,
            })
          )
        ).toMatchObject(denied("role"));
      })
  );
});
