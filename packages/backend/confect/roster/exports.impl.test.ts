import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  schoolKeys,
  writeRosterEntry,
} from "@repo/backend/confect/roster/entry";
import { EXPORT_PAGE } from "@repo/backend/confect/roster/exports.impl";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { cohort, denied, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool } from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";

const { lines } = refs.public.roster.exports;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** One more student than a page of the export holds, so the export reads two pages. */
const STUDENTS = Arr.makeBy(EXPORT_PAGE + 1, (index) => ({
  name: `Siswa ${index}`,
  nisn: Schema.decodeSync(Nisn)(Str.padStart(10, "0")(String(index + 1))),
}));

describe("roster/exports", () => {
  it.effect(
    "reads every student of the period across pages, with the NISN and class group",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-A");
        // A student placed by hand has no roster row, so the export leaves the NISN empty.
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.placements.place, {
            cohortId: x1.id,
            personId: fixture.people.student.personId,
            slug: nf,
          });
        // The export reads the placements and roster rows that an import leaves, so the students
        // are written as an import writes them, in one transaction: the import has its own tests.
        yield* fixture.run(
          Effect.flatMap(schoolKeys(fixture.tenants.nf), (keys) =>
            Effect.forEach(
              STUDENTS,
              (student) =>
                Effect.gen(function* () {
                  const writer = yield* DatabaseWriter;
                  const personId = yield* writer.table("tenantPeople").insert({
                    account: { state: "unclaimed" },
                    kind: "member",
                    name: student.name,
                    status: "active",
                    tenantId: fixture.tenants.nf,
                  });
                  yield* writer.table("tenantCohortMembers").insert({
                    cohortId: x1.id,
                    periodId: term.id,
                    personId,
                    tenantId: fixture.tenants.nf,
                  });
                  const person = yield* (yield* DatabaseReader)
                    .table("tenantPeople")
                    .get(personId);
                  yield* writeRosterEntry(keys, person, {
                    nisn: Option.some(student.nisn),
                    underAgeLimit: true,
                  });
                }).pipe(Effect.orDie),
              { discard: true }
            )
          )
        );
        const exported = yield* fixture
          .as("counselor")
          .action(lines, { periodId: term.id, slug: nf });
        expect(Arr.length(exported)).toBe(EXPORT_PAGE + 2);
        expect(
          Arr.sort(
            Arr.map(exported, (line) => line.nisn ?? ""),
            Str.Order
          )
        ).toEqual(["", ...Arr.map(STUDENTS, (student) => student.nisn)]);
        expect(Arr.every(exported, (line) => line.cohortName === "VII-A")).toBe(
          true
        );
      })
  );

  it.effect(
    "keeps the export to the school's Admin and Staff, and to a signed-in member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const args = { periodId: term.id, slug: nf };
        expect(
          yield* Effect.flip(fixture.as("teacher").action(lines, args))
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(fixture.as("otherOwner").action(lines, args))
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(fixture.anonymous.action(lines, args))
        ).toMatchObject({ _tag: "SessionRequired" });
      })
  );
});
