import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  checkCohorts,
  insertCohort,
} from "@repo/backend/confect/tenancy/write/cohort";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const periods = refs.public.tenancy.periods;

describe("tenancy/write cohort", () => {
  it.effect(
    "refuses a name the period already has, and a batch past the period's limit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026/2027",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.smp,
        });
        const period = {
          _id: made.id,
          tenantId: fixture.tenants.nf,
          unitId: fixture.units.smp,
        };
        const actor = {
          id: fixture.people.admin.personId,
          kind: "person" as const,
        };
        yield* fixture.run(
          insertCohort(actor, period, { grade: 7, name: "7A" })
        );
        const taken = yield* fixture.run(
          checkCohorts(period, [{ grade: 8, name: "7a" }]).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(taken).toBe("CohortNameTaken");
        yield* fixture.run(
          Effect.forEach(
            Arr.range(1, 199),
            (number) =>
              insertCohort(actor, period, {
                grade: 7,
                name: `Kelas ${number}`,
              }),
            { discard: true }
          )
        );
        const full = yield* fixture.run(
          checkCohorts(period, [{ grade: 9, name: "Kelas 200" }]).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(full).toBe("CohortLimit");
      })
  );

  it.effect("inserts each cohort and journals each creation once", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("admin").mutation(periods.create, {
        end: "2026-12-19",
        name: "Ganjil 2026/2027",
        slug: nf,
        start: "2026-07-13",
        unitId: fixture.units.smp,
      });
      const period = {
        _id: made.id,
        tenantId: fixture.tenants.nf,
        unitId: fixture.units.smp,
      };
      const actor = {
        id: fixture.people.admin.personId,
        kind: "person" as const,
      };
      const rows = yield* fixture.run(
        Effect.forEach(
          [
            { grade: 7, name: "7A" },
            { grade: 8, name: "8A" },
          ],
          (cohort) => insertCohort(actor, period, cohort)
        )
      );
      expect(Arr.map(rows, (row) => row.name)).toEqual(["7A", "8A"]);
      const created = Arr.filter(
        yield* fixture.run(journal),
        (entry) => entry.change.type === "cohort.created"
      );
      expect(Arr.map(created, (entry) => entry.subject)).toEqual(
        Arr.map(rows, (row) => ({ id: row._id, kind: "cohort" }))
      );
    })
  );
});
