import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  approvedPromotion,
  drain,
  nf,
  periods,
  promotion,
  readPromotion,
  runPromotion,
  scenario,
  snapshot,
  undoOnce,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { apply } = promotion.apply;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion archive step", () => {
  it.effect(
    "stops the first step when its source period was archived after the apply began",
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
          failure: "SourcePeriodInvalid",
          running: false,
          step: "archive",
        });
      })
  );

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
