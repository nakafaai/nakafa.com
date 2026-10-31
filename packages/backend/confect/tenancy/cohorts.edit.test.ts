import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { create, edit, list } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMA period of the fixture as its Admin, planned, and returns the period the mutation made. */
const sma = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.sma,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  grade: number
) => fixture.as("admin").mutation(create, { grade, name, periodId, slug: nf });

describe("tenancy/cohorts edit", () => {
  it.effect(
    "renames a cohort, and keeps a case-only change to its own name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventh = yield* cohort(fixture, period.id, "7A", 7);
        yield* cohort(fixture, period.id, "7B", 7);
        const caseOnly = yield* fixture.as("admin").mutation(edit, {
          cohortId: seventh.id,
          grade: 7,
          name: "7a",
          slug: nf,
        });
        const same = yield* fixture.as("admin").mutation(edit, {
          cohortId: seventh.id,
          grade: 7,
          name: "7a",
          slug: nf,
        });
        const taken = yield* fixture
          .as("admin")
          .mutation(edit, {
            cohortId: seventh.id,
            grade: 7,
            name: "7b",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([caseOnly.name, same.name]).toEqual(["7a", "7a"]);
        expect(taken).toMatchObject({ _tag: "CohortNameTaken" });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.renamed" }, subject: { id: seventh.id } },
        ]);
      })
  );

  it.effect(
    "moves a cohort to another school year, records the year alone, and lists it in its new place",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventh = yield* cohort(fixture, period.id, "7A", 7);
        yield* cohort(fixture, period.id, "8A", 8);
        const moved = yield* fixture.as("admin").mutation(edit, {
          cohortId: seventh.id,
          grade: 9,
          name: "7A",
          slug: nf,
        });
        const listed = yield* fixture
          .as("admin")
          .query(list, { periodId: period.id, slug: nf });
        expect(moved).toMatchObject({ grade: 9, name: "7A" });
        expect(Arr.map(listed, (row) => [row.name, row.grade])).toEqual([
          ["8A", 8],
          ["7A", 9],
        ]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.created" } },
          {
            change: { grade: 9, type: "cohort.grade.set" },
            subject: { id: seventh.id },
          },
        ]);
      })
  );
});

describe("tenancy/cohorts archived school", () => {
  it.effect("refuses an edit of a cohort in an archived school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const cohortId = yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const periodId = yield* writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Smk",
            start: "2026-07-13",
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          });
          return yield* writer.table("tenantCohorts").insert({
            grade: 10,
            name: "10A",
            nameKey: "10a",
            periodId,
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          });
        })
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(edit, { cohortId, grade: 10, name: "10B", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("condition"));
    })
  );
});
