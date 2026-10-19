import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  foreignCohort,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const nf = slugOf("nf");
const { archive, create, restore } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const missingCohort = Schema.decodeUnknownSync(Id("tenantCohorts"))(
  "000000000000000099999tenantCohorts"
);

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

describe("tenancy/cohorts restore", () => {
  it.effect("restores an archived cohort to active, and journals it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      const made = yield* cohort(fixture, period.id, "7A", 7);
      yield* fixture
        .as("admin")
        .mutation(archive, { cohortId: made.id, slug: nf });
      const restored = yield* fixture
        .as("admin")
        .mutation(restore, { cohortId: made.id, slug: nf });
      expect(restored.status).toBe("active");
      expect(
        Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
      ).toContain("cohort.restored");
    })
  );

  it.effect("changes nothing when the cohort is already active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      const made = yield* cohort(fixture, period.id, "7A", 7);
      const again = yield* fixture
        .as("admin")
        .mutation(restore, { cohortId: made.id, slug: nf });
      expect(again.status).toBe("active");
      expect(
        Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
      ).not.toContain("cohort.restored");
    })
  );

  it.effect(
    "refuses a restore of a missing cohort, of another school, and in an archived period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const foreign = yield* foreignCohort(fixture);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: period.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(archive, { cohortId: made.id, slug: nf });
        const refusals = yield* Effect.forEach(
          [missingCohort, foreign.id, made.id],
          (cohortId, index) =>
            Effect.gen(function* () {
              if (index === 2) {
                yield* fixture
                  .as("admin")
                  .mutation(periods.archive, { periodId: period.id, slug: nf });
              }
              return yield* fixture
                .as("admin")
                .mutation(restore, { cohortId, slug: nf })
                .pipe(Effect.flip);
            })
        );
        expect(refusals).toMatchObject([
          { _tag: "AccessDenied", reason: "resource" },
          { _tag: "AccessDenied", reason: "resource" },
          { _tag: "AccessDenied", reason: "condition" },
        ]);
      })
  );
});
