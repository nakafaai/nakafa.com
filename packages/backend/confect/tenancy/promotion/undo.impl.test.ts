import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  allJournal,
  approvedPromotion,
  cohort,
  crowd,
  denied,
  drain,
  entriesOf,
  flipGrants,
  nf,
  periods,
  promotion,
  readPromotion,
  runPromotion,
  scenario,
  scenarioPlan,
  snapshot,
  undoOnce,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { plan } = promotion.draft;
const { apply } = promotion.apply;
const { undo } = promotion.undo;
const { cancel } = promotion.review;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion undo", () => {
  it.effect(
    "undoes the steps last first, and restores every row exactly as it was before apply",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        const started = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(started.progress).toMatchObject({
          direction: "undo",
          running: true,
          step: "homeroom",
        });
        const afterHomeroom = yield* drain(fixture, promotionId);
        expect(afterHomeroom.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
        ]);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(reverted).toMatchObject({
          progress: { done: [] },
          state: "approved",
        });
        expect(yield* snapshot(fixture)).toEqual(before);
        expect(yield* entriesOf(fixture, "promotion.undone")).toHaveLength(6);
        const refusal = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect("logs every undone write with the step it undid", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      yield* drain(fixture, promotionId);
      yield* undoOnce(fixture, promotionId);
      const undone = Arr.filter(
        yield* fixture.run(allJournal),
        (entry) => entry.change.type === "promotion.undone"
      );
      expect(undone).toMatchObject([
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { step: "homeroom" },
          subject: { id: promotionId, kind: "promotion" },
        },
      ]);
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
    "undoes the archive that a stopped cohorts step left finished, and returns the plan to approved",
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
        yield* cohort(fixture, s.target.id, "8a", 8);
        const stopped = yield* fixture.internal
          .mutation(runPromotion, {
            actorId: fixture.people.admin.personId,
            promotionId,
          })
          .pipe(Effect.andThen(readPromotion(fixture, promotionId)));
        expect(stopped.progress).toMatchObject({
          done: ["archive"],
          failure: "CohortNameTaken",
          running: false,
          step: "cohorts",
        });
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(reverted).toMatchObject({
          progress: { cursor: null, direction: null, done: [], step: null },
          state: "approved",
        });
      })
  );

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
    "undoes a stopped apply: the steps it finished come back first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
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
        yield* flipGrants(
          fixture,
          [s.first, s.second, s.third],
          "active",
          "revoked"
        );
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const stopped = yield* readPromotion(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          direction: "apply",
          failure: "PersonNotStudent",
          step: "place",
        });
        const undone = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(undone.progress).toMatchObject({
          direction: "undo",
          running: true,
          step: "cohorts",
        });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
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
        yield* fixture.as("admin").mutation(plan, {
          promotionId,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        const cancelled = yield* fixture
          .as("admin")
          .mutation(cancel, { promotionId, slug: nf });
        expect(cancelled.state).toBe("cancelled");
        expect(yield* entriesOf(fixture, "promotion.undone")).toMatchObject([
          { change: { step: "archive", type: "promotion.undone" } },
        ]);
      })
  );
});
