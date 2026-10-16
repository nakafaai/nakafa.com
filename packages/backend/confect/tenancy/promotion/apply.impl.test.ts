import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  approvedPromotion,
  cohort,
  drain,
  nf,
  periods,
  promotion,
  readPromotion,
  runPromotion,
  scenario,
  undoOnce,
} from "@repo/backend/test/promotion";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create } = promotion.draft;
const { apply } = promotion.apply;
const { undo } = promotion.undo;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
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
