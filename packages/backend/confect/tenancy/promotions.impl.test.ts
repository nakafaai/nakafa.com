import { describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  entriesOf,
  nf,
  periodPair,
  periods,
  promotionReview,
  promotions,
  scenario,
} from "@repo/backend/test/promotion";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create, get } = promotions;
const { approve, cancel } = promotionReview;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const idle = {
  cursor: null,
  direction: null,
  done: [],
  failure: null,
  running: false,
  step: null,
};

describe("tenancy/promotions create", () => {
  it.effect(
    "starts a draft from an active period to a planned one after it, and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { source, target } = yield* periodPair(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: source.id,
          slug: nf,
          targetPeriodId: target.id,
        });
        expect(made).toEqual({
          id: expect.any(String),
          progress: idle,
          returnReason: null,
          sourcePeriodId: source.id,
          sources: [],
          state: "draft",
          targetPeriodId: target.id,
          targets: [],
        });
        expect(yield* entriesOf(fixture, "promotion.created")).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            subject: { id: made.id, kind: "promotion" },
          },
        ]);
      })
  );

  it.effect("refuses a source period that is not active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { target } = yield* periodPair(fixture);
      const planned = yield* fixture.as("admin").mutation(periods.create, {
        end: "2025-06-20",
        name: "Lama",
        slug: nf,
        start: "2025-01-11",
        unitId: fixture.units.smp,
      });
      const refusal = yield* fixture
        .as("admin")
        .mutation(create, {
          periodId: planned.id,
          slug: nf,
          targetPeriodId: target.id,
        })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SourcePeriodInvalid" });
    })
  );

  it.effect(
    "refuses a target that is the source, is in another unit, or starts too early, and denies a target of another school or one that is gone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { source } = yield* periodPair(fixture);
        const earlier = yield* fixture.as("admin").mutation(periods.create, {
          end: "2026-06-20",
          name: "Sebelum",
          slug: nf,
          start: "2026-01-05",
          unitId: fixture.units.smp,
        });
        const sma = yield* fixture.as("admin").mutation(periods.create, {
          end: "2027-06-20",
          name: "SMA",
          slug: nf,
          start: "2027-01-11",
          unitId: fixture.units.sma,
        });
        const foreign = yield* fixture
          .as("otherOwner")
          .mutation(periods.create, {
            end: "2027-06-20",
            name: "Sekolah Lain",
            slug: slugOf("other"),
            start: "2027-01-11",
            unitId: fixture.units.sd,
          });
        const gone = yield* fixture.as("admin").mutation(periods.create, {
          end: "2028-06-20",
          name: "Hilang",
          slug: nf,
          start: "2028-01-11",
          unitId: fixture.units.smp,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeriods").delete(gone.id)
          )
        );
        const refusals = yield* Effect.forEach(
          [source.id, earlier.id, sma.id, foreign.id, gone.id],
          (targetPeriodId) =>
            fixture
              .as("admin")
              .mutation(create, {
                periodId: source.id,
                slug: nf,
                targetPeriodId,
              })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          { _tag: "TargetPeriodInvalid" },
          { _tag: "TargetPeriodInvalid" },
          { _tag: "TargetPeriodInvalid" },
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect(
    "refuses a second live promotion for a source period, and shows it only while it is live",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { source, target } = yield* periodPair(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: source.id,
          slug: nf,
          targetPeriodId: target.id,
        });
        const second = yield* fixture
          .as("admin")
          .mutation(create, {
            periodId: source.id,
            slug: nf,
            targetPeriodId: target.id,
          })
          .pipe(Effect.flip);
        const shown = yield* fixture
          .as("admin")
          .query(get, { periodId: source.id, slug: nf });
        expect(second).toMatchObject({ _tag: "PromotionState" });
        expect(shown).toMatchObject({ id: made.id, state: "draft" });
        yield* fixture
          .as("admin")
          .mutation(cancel, { promotionId: made.id, slug: nf });
        const after = yield* fixture
          .as("admin")
          .query(get, { periodId: source.id, slug: nf });
        expect(after).toBeNull();
      })
  );
});

describe("tenancy/promotions tenant isolation", () => {
  it.effect(
    "refuses a caller with no Person in the school, and another school's Owner",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const stranger = yield* fixture
          .as("stranger")
          .query(get, { periodId: s.source.id, slug: nf })
          .pipe(Effect.flip);
        const foreign = yield* fixture
          .as("otherOwner")
          .mutation(approve, { promotionId: made.id, slug: slugOf("other") })
          .pipe(Effect.flip);
        expect(stranger).toMatchObject({ _tag: "NotMember" });
        expect(foreign).toMatchObject(denied("resource"));
      })
  );
});
