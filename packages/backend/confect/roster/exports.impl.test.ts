import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { EXPORT_PAGE } from "@repo/backend/confect/roster/exports.impl";
import { IMPORT_BATCH, Nisn } from "@repo/backend/confect/roster/schema";
import { cohort, denied, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool } from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema, String as Str } from "effect";

const { lines } = refs.public.roster.exports;
const { apply } = refs.public.roster.imports;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** One more student than a page of the export holds, so the export reads two pages. */
const STUDENTS = Arr.makeBy(EXPORT_PAGE + 1, (index) => ({
  cohortName: "VII-A",
  name: `Siswa ${index}`,
  nisn: Schema.decodeSync(Nisn)(Str.padStart(10, "0")(String(index + 1))),
  underAgeLimit: true,
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
        for (const rows of Arr.chunksOf(STUDENTS, IMPORT_BATCH)) {
          yield* fixture
            .as("admin")
            .mutation(apply, { periodId: term.id, rows, slug: nf });
        }
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
