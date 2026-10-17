import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import { classOf } from "@repo/backend/test/classroom";
import {
  approvedPromotion,
  assignments,
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
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
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
    "undoes a created cohort that names a removed homeroom teacher, and clears that row with the cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        const second = yield* fixture.as("admin").mutation(people.create, {
          name: "Guru Kedua",
          slug: nf,
        });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, second.id, "teacher", {
            kind: "unit",
            unitId: fixture.units.smp,
          })
        );
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: eightA.cohortId,
          personId: second.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: second.id,
          slug: nf,
        });
        const undone = yield* undoOnce(fixture, promotionId);
        expect(undone.progress.failure).toBeNull();
        const state = yield* snapshot(fixture);
        expect(
          Arr.some(state.cohorts, (row) => row._id === eightA.cohortId)
        ).toBe(false);
        expect(
          Arr.some(state.assignments, (row) => row.cohortId === eightA.cohortId)
        ).toBe(false);
      })
  );

  it.effect(
    "refuses to undo a created cohort that an active homeroom teacher holds, and keeps the cohort and the row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        const second = yield* fixture.as("admin").mutation(people.create, {
          name: "Guru Kedua",
          slug: nf,
        });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, second.id, "teacher", {
            kind: "unit",
            unitId: fixture.units.smp,
          })
        );
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: eightA.cohortId,
          personId: second.id,
          slug: nf,
        });
        const stopped = yield* undoOnce(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          direction: "undo",
          failure: "PromotionCohortOccupied",
          running: false,
          step: "cohorts",
        });
        const state = yield* snapshot(fixture);
        expect(
          Arr.some(state.cohorts, (row) => row._id === eightA.cohortId)
        ).toBe(true);
        expect(
          Arr.some(state.assignments, (row) => row.cohortId === eightA.cohortId)
        ).toBe(true);
      })
  );

  it.effect(
    "refuses to undo a created cohort that still holds a class, and keeps the cohort and the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        yield* classOf(fixture, eightA.cohortId, "Fisika");
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
        const state = yield* snapshot(fixture);
        expect(
          Arr.some(state.cohorts, (row) => row._id === eightA.cohortId)
        ).toBe(true);
        const held = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("classes")
              .index("by_cohortId_and_status_and_nameKey", (query) =>
                query.eq("cohortId", eightA.cohortId)
              )
              .take(5)
          )
        );
        expect(held).toHaveLength(1);
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
