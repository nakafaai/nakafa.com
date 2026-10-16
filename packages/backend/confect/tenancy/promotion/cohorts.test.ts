import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import {
  approvedPromotion,
  cohort,
  createdFor,
  drain,
  nf,
  people,
  placedStudent,
  promotion,
  scenario,
  snapshot,
  undoOnce,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { apply } = promotion.apply;
const { undo } = promotion.undo;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion cohorts step", () => {
  it.effect(
    "stops the cohorts step at a name that a cohort of the target period took after approval",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* cohort(fixture, s.target.id, "8a", 8);
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "CohortNameTaken",
          running: false,
          step: "cohorts",
        });
      })
  );

  it.effect(
    "stops the cohorts step when the target period holds the most cohorts it can",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.range(1, COHORT_LIMIT),
              (index) =>
                writer.table("tenantCohorts").insert({
                  grade: 1,
                  name: `Kelas ${index}`,
                  nameKey: `kelas ${index}`,
                  periodId: s.target.id,
                  status: "active",
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.smp,
                }),
              { discard: true }
            )
          )
        );
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "CohortLimit",
          running: false,
          step: "cohorts",
        });
      })
  );

  it.effect(
    "refuses to undo the cohorts while a student was added to one by hand, and resumes once that student is removed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        const added = yield* placedStudent(
          fixture,
          eightA.cohortId,
          "Siswa Manual"
        );
        const stopped = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.andThen(drain(fixture, promotionId)));
        expect(stopped.progress).toMatchObject({
          direction: "undo",
          failure: "PromotionCohortOccupied",
          running: false,
          step: "cohorts",
        });
        const applyWhileStopped = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(applyWhileStopped).toMatchObject({ _tag: "PromotionState" });
        yield* fixture
          .as("admin")
          .mutation(people.remove, { personId: added, slug: nf });
        yield* fixture.as("admin").mutation(undo, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        expect(yield* snapshot(fixture)).toEqual(before);
      })
  );
});
