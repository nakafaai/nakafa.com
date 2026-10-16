import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import { PROMOTION_RUN_LEASE } from "@repo/backend/confect/tenancy/promotion/progress";
import {
  approvedPromotion,
  cohort,
  drain,
  entriesOf,
  nf,
  people,
  periods,
  promotion,
  readPromotion,
  runPromotion,
  scenario,
  snapshot,
  toEightA,
  undoOnce,
} from "@repo/backend/test/promotion";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const { create } = promotion.draft;
const { apply } = promotion.apply;
const { undo } = promotion.undo;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion run lease", () => {
  it.effect(
    "resumes an apply that stopped without a failure and has not moved for the lease, and finishes it",
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
        vi.setSystemTime(NOW + Duration.toMillis(PROMOTION_RUN_LEASE));
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: null,
          running: false,
        });
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
      })
  );

  it.effect("refuses to apply or undo a run that moved within the lease", () =>
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
      vi.setSystemTime(NOW + 1000);
      const applied = yield* fixture
        .as("admin")
        .mutation(apply, { promotionId, slug: nf })
        .pipe(Effect.flip);
      const undone = yield* fixture
        .as("admin")
        .mutation(undo, { promotionId, slug: nf })
        .pipe(Effect.flip);
      expect(applied).toMatchObject({ _tag: "PromotionState" });
      expect(undone).toMatchObject({ _tag: "PromotionState" });
    })
  );

  it.effect(
    "backs out a stalled apply through undo, one finished step at a time",
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
        vi.setSystemTime(NOW + Duration.toMillis(PROMOTION_RUN_LEASE));
        const backedOut = yield* undoOnce(fixture, promotionId);
        expect(backedOut.progress).toMatchObject({
          failure: null,
          running: false,
        });
        expect(backedOut.progress.done).toEqual(["archive"]);
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(reverted.state).toBe("approved");
      })
  );
});

describe("tenancy/promotion apply refusals", () => {
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
      expect(foreign).toMatchObject({
        _tag: "AccessDenied",
        reason: "resource",
      });
    })
  );
});

describe("tenancy/promotion apply target period", () => {
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
});

describe("tenancy/promotion apply removal and graduates", () => {
  it.effect(
    "a student removed while the source period is archived keeps their history placement, and the run neither moves nor graduates them",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        // Only the archive step runs here, so the source period is archived when the student leaves.
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture
          .as("admin")
          .mutation(people.remove, { personId: s.first, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: null,
          running: false,
        });
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
        expect(yield* entriesOf(fixture, "person.moved")).toHaveLength(1);
        const keptAsHistory = fixture.run(
          Effect.map(placementOf(s.source.id, s.first), Option.isSome)
        );
        expect(yield* keptAsHistory).toBe(true);
        const movedToTarget = fixture.run(
          Effect.map(placementOf(s.target.id, s.first), Option.isSome)
        );
        expect(yield* movedToTarget).toBe(false);
      })
  );

  it.effect(
    "refuses to graduate a Person who already graduated from the unit, and writes no second graduation",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGraduates").insert({
              personId: s.third,
              promotionId,
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            })
          )
        );
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonGraduated",
          running: false,
          step: "place",
        });
        expect(yield* entriesOf(fixture, "person.graduated")).toEqual([]);
        const state = yield* snapshot(fixture);
        expect(
          Arr.filter(state.graduates, (row) => row.personId === s.third)
        ).toHaveLength(1);
      })
  );

  it.effect(
    "refuses to place a Person who already graduated from the unit in a new cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s, {
          sources: [
            { cohortId: s.seventh.id, homeroom: true, to: toEightA },
            { cohortId: s.ninth.id, homeroom: false, to: toEightA },
          ],
          targets: [{ grade: 8, name: "8A" }],
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGraduates").insert({
              personId: s.third,
              promotionId,
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            })
          )
        );
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonGraduated",
          running: false,
          step: "place",
        });
        expect(yield* entriesOf(fixture, "person.moved")).toEqual([]);
      })
  );
});

describe("tenancy/promotion apply again", () => {
  it.effect("applies again from the step after the last one undone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      yield* drain(fixture, promotionId);
      yield* undoOnce(fixture, promotionId);
      const resumed = yield* fixture
        .as("admin")
        .mutation(apply, { promotionId, slug: nf });
      expect(resumed.progress).toMatchObject({
        direction: "apply",
        running: true,
        step: "homeroom",
      });
      const finished = yield* drain(fixture, promotionId);
      expect(finished.progress.done).toEqual([
        "archive",
        "cohorts",
        "place",
        "homeroom",
      ]);
    })
  );

  it.effect(
    "refuses to apply a promotion whose steps all finished, and to undo one that is not applied",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        const onApproved = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.flip);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        const again = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(onApproved).toMatchObject({ _tag: "PromotionState" });
        expect(again).toMatchObject({ _tag: "PromotionState" });
      })
  );
});
