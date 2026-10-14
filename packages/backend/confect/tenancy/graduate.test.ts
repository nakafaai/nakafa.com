import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const nf = slugOf("nf");
const { place } = refs.public.tenancy.placements;
const { create } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;

describe("tenancy/graduate placement", () => {
  it.effect(
    "refuses to place a student who graduated from the unit, in any period of it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* fixture.as("admin").mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026/2027",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.smp,
        });
        const made = yield* fixture.as("admin").mutation(create, {
          grade: 7,
          name: "7A",
          periodId: period.id,
          slug: nf,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.gen(function* () {
              const promotionId = yield* writer
                .table("tenantPromotions")
                .insert({
                  copies: [],
                  created: [],
                  progress: {
                    cursor: null,
                    direction: null,
                    done: [],
                    failure: null,
                    running: false,
                    step: null,
                  },
                  returnReason: null,
                  sourcePeriodId: period.id,
                  sources: [],
                  state: "opened",
                  targetPeriodId: period.id,
                  targets: [],
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.smp,
                });
              yield* writer.table("tenantGraduates").insert({
                personId: fixture.people.student.personId,
                promotionId,
                tenantId: fixture.tenants.nf,
                unitId: fixture.units.smp,
              });
            })
          )
        );
        const refusal = yield* fixture
          .as("admin")
          .mutation(place, {
            cohortId: made.id,
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "PersonGraduated" });
      })
  );
});
