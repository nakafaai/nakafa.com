import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  approvedPromotion,
  cohort,
  crowd,
  drain,
  entriesOf,
  flipGrants,
  nf,
  periods,
  promotionApply,
  promotionReview,
  promotions,
  readPromotion,
  runPromotion,
  scenario,
  scenarioPlan,
  snapshot,
  undoOnce,
} from "@repo/backend/test/promotion";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create } = promotions;
const { apply, undo } = promotionApply;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotionApply refusals", () => {
  it.effect(
    "refuses to apply a plan that a new cohort of the source outgrew",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* cohort(fixture, s.source.id, "7B", 7);
        const refusal = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({
          _tag: "PromotionPlanInvalid",
          reason: "sources",
        });
        expect((yield* readPromotion(fixture, promotionId)).state).toBe(
          "approved"
        );
      })
  );

  it.effect(
    "refuses to apply twice, and to undo while a run is in flight",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const twice = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        const undoWhileRunning = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(twice).toMatchObject({ _tag: "PromotionState" });
        expect(undoWhileRunning).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect("refuses to apply a source period archived by hand", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture
        .as("admin")
        .mutation(periods.archive, { periodId: s.source.id, slug: nf });
      const refusal = yield* fixture
        .as("admin")
        .mutation(apply, { promotionId, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SourcePeriodInvalid" });
    })
  );

  it.effect("refuses to apply a draft", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      const onDraft = yield* fixture
        .as("admin")
        .mutation(apply, { promotionId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(onDraft).toMatchObject({ _tag: "PromotionState" });
    })
  );

  it.effect("refuses another school's Owner to apply a promotion", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      const foreign = yield* fixture
        .as("otherOwner")
        .mutation(apply, { promotionId, slug: slugOf("other") })
        .pipe(Effect.flip);
      expect(foreign).toMatchObject(denied("resource"));
    })
  );
});

describe("tenancy/promotionApply target period", () => {
  it.effect(
    "refuses to open the target while its promotion is still approved",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: s.source.id, slug: nf });
        const early = yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: s.target.id, slug: nf })
          .pipe(Effect.flip);
        expect(early).toMatchObject({ _tag: "PromotionState" });
        expect((yield* readPromotion(fixture, promotionId)).state).toBe(
          "approved"
        );
      })
  );

  it.effect(
    "refuses to open the target while its promotion has steps left to run",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const midway = yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: s.target.id, slug: nf })
          .pipe(Effect.flip);
        expect(midway).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect("refuses to undo an applied promotion once its target opened", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      yield* drain(fixture, promotionId);
      yield* fixture
        .as("admin")
        .mutation(periods.open, { periodId: s.target.id, slug: nf });
      const refusal = yield* fixture
        .as("admin")
        .mutation(undo, { promotionId, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject(denied("condition"));
    })
  );

  it.effect(
    "refuses a target that a live promotion of the same unit already holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        yield* approvedPromotion(fixture, s);
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: s.source.id, slug: nf });
        const next = yield* fixture.as("admin").mutation(periods.create, {
          end: "2027-01-05",
          name: "Pendek",
          slug: nf,
          start: "2026-12-21",
          unitId: fixture.units.smp,
        });
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: next.id, slug: nf });
        const refusal = yield* fixture
          .as("admin")
          .mutation(create, {
            periodId: next.id,
            slug: nf,
            targetPeriodId: s.target.id,
          })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "TargetPeriodInvalid" });
      })
  );
});

describe("tenancy/promotionApply undo of the source period", () => {
  it.effect(
    "refuses to reactivate the source period while another period of the unit is active",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const next = yield* fixture.as("admin").mutation(periods.create, {
          end: "2027-01-05",
          name: "Pendek",
          slug: nf,
          start: "2026-12-21",
          unitId: fixture.units.smp,
        });
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: next.id, slug: nf });
        const stopped = yield* undoOnce(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          direction: "undo",
          failure: "PeriodActive",
          running: false,
          step: "archive",
        });
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: next.id, slug: nf });
        const resumed = yield* undoOnce(fixture, promotionId);
        expect(resumed).toMatchObject({
          progress: { done: [] },
          state: "approved",
        });
        const state = yield* snapshot(fixture);
        expect(
          Arr.filter(state.periods, (row) => row._id === s.source.id)
        ).toMatchObject([{ status: "active" }]);
      })
  );
});

describe("tenancy/promotionApply stopped undo", () => {
  it.effect(
    "undoes the placements a stopped page wrote before it stopped, then the steps it finished",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const extra = yield* crowd(fixture, s.seventh.id, s.source.id, 150);
        const everyone = [s.first, s.second, s.third, ...extra];
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* flipGrants(fixture, everyone, "active", "revoked");
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const stopped = yield* readPromotion(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          direction: "apply",
          failure: "PersonNotStudent",
          running: false,
          step: "place",
        });
        expect(stopped.progress.cursor).not.toBeNull();
        const undone = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(undone.progress).toMatchObject({
          direction: "undo",
          running: true,
          step: "place",
        });
        const placesUndone = yield* drain(fixture, promotionId);
        expect(placesUndone.progress.done).toEqual(["archive", "cohorts"]);
        yield* undoOnce(fixture, promotionId);
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(reverted).toMatchObject({
          progress: { done: [] },
          state: "approved",
        });
        expect(yield* snapshot(fixture)).toEqual(before);
      })
  );

  it.effect(
    "returns an apply that stopped before any step finished to approved, and its plan can then be cancelled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: s.source.id, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const stopped = yield* readPromotion(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          done: [],
          failure: "SourcePeriodInvalid",
          running: false,
          step: "archive",
        });
        const undone = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(undone).toMatchObject({
          progress: {
            cursor: null,
            direction: null,
            done: [],
            failure: null,
            running: false,
            step: null,
          },
          state: "approved",
        });
        yield* fixture.as("admin").mutation(promotions.plan, {
          promotionId,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        const cancelled = yield* fixture
          .as("admin")
          .mutation(promotionReview.cancel, { promotionId, slug: nf });
        expect(cancelled.state).toBe("cancelled");
        expect(yield* entriesOf(fixture, "promotion.undone")).toMatchObject([
          { change: { step: "archive", type: "promotion.undone" } },
        ]);
      })
  );
});
