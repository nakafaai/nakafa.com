import { describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import type { PromotionDestination } from "@repo/backend/confect/tenancy/promotion/schema";
import {
  approvedPromotion,
  cohort,
  denied,
  entriesOf,
  nf,
  periodPair,
  periods,
  promotion,
  scenario,
  scenarioPlan,
  toEightA,
  toGraduate,
  toStay,
} from "@repo/backend/test/promotion";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, get, plan } = promotion.draft;
const { cancel } = promotion.review;
const idle = {
  cursor: null,
  direction: null,
  done: [],
  failure: null,
  movedAt: 0,
  running: false,
  step: null,
};

describe("tenancy/promotion draft create", () => {
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

describe("tenancy/promotion draft tenant isolation", () => {
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
          .mutation(plan, {
            promotionId: made.id,
            slug: slugOf("other"),
            ...scenarioPlan(s.seventh, s.ninth),
          })
          .pipe(Effect.flip);
        expect(stranger).toMatchObject({ _tag: "NotMember" });
        expect(foreign).toMatchObject(denied("resource"));
      })
  );
});

describe("tenancy/promotion draft plan", () => {
  it.effect("replaces the plan, keeps it in draft, and journals it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      const planned = yield* fixture.as("admin").mutation(plan, {
        promotionId: made.id,
        slug: nf,
        ...scenarioPlan(s.seventh, s.ninth),
      });
      expect(planned).toMatchObject({
        returnReason: null,
        sources: [
          { cohortId: s.seventh.id, homeroom: true, to: toEightA },
          { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
        ],
        state: "draft",
        targets: [{ grade: 8, name: "8A" }],
      });
      expect(yield* entriesOf(fixture, "promotion.planned")).toHaveLength(1);
    })
  );

  it.effect(
    "refuses a plan with a cohort missing, a cohort twice, or a cohort of another period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const foreign = yield* cohort(fixture, s.target.id, "Lain", 7);
        const base = scenarioPlan(s.seventh, s.ninth);
        const attempt = (sources: typeof base.sources) =>
          fixture
            .as("admin")
            .mutation(plan, {
              promotionId: made.id,
              slug: nf,
              sources,
              targets: base.targets,
            })
            .pipe(Effect.flip);
        const refusals = yield* Effect.all([
          attempt([base.sources[0]]),
          attempt([base.sources[0], base.sources[0]]),
          attempt([
            base.sources[0],
            { cohortId: foreign.id, homeroom: false, to: toGraduate },
          ]),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "PromotionPlanInvalid", reason: "sources" },
          { _tag: "PromotionPlanInvalid", reason: "sources" },
          { _tag: "PromotionPlanInvalid", reason: "sources" },
        ]);
      })
  );

  it.effect(
    "refuses a destination the plan does not create, graduation below the last grade, and a homeroom teacher copied to a graduating cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const base = scenarioPlan(s.seventh, s.ninth);
        const attempt = (sources: typeof base.sources) =>
          fixture
            .as("admin")
            .mutation(plan, {
              promotionId: made.id,
              slug: nf,
              sources,
              targets: base.targets,
            })
            .pipe(Effect.flip);
        const refusals = yield* Effect.all([
          attempt([
            {
              cohortId: s.seventh.id,
              homeroom: true,
              to: { kind: "cohort", name: "Nol" },
            },
            base.sources[1],
          ]),
          attempt([
            { cohortId: s.seventh.id, homeroom: false, to: toGraduate },
            base.sources[1],
          ]),
          attempt([
            base.sources[0],
            { cohortId: s.ninth.id, homeroom: true, to: toGraduate },
          ]),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "PromotionPlanInvalid", reason: "destination" },
          { _tag: "PromotionPlanInvalid", reason: "graduate" },
          { _tag: "PromotionPlanInvalid", reason: "homeroom" },
        ]);
      })
  );

  it.effect(
    "accepts graduation in the last grade of the unit, and a repeated year only with its cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const base = scenarioPlan(s.seventh, s.ninth);
        const withoutRepeat = yield* fixture
          .as("admin")
          .mutation(plan, {
            promotionId: made.id,
            slug: nf,
            sources: [
              { cohortId: s.seventh.id, homeroom: false, to: toStay },
              base.sources[1],
            ],
            targets: base.targets,
          })
          .pipe(Effect.flip);
        const withRepeat = yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          sources: [
            { cohortId: s.seventh.id, homeroom: false, to: toStay },
            base.sources[1],
          ],
          targets: [...base.targets, { grade: 7, name: "7A" }],
        });
        expect(withoutRepeat).toMatchObject({
          _tag: "PromotionPlanInvalid",
          reason: "stay",
        });
        expect(withRepeat.sources).toMatchObject([
          { to: { kind: "stay" } },
          { to: { kind: "graduate" } },
        ]);
      })
  );

  it.effect(
    "refuses two targets with one name, a name a cohort of the target period holds, and more targets than a period holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const base = scenarioPlan(s.seventh, s.ninth);
        yield* cohort(fixture, s.target.id, "8C", 8);
        const attempt = (
          targets: typeof base.targets,
          sources: typeof base.sources = base.sources
        ) =>
          fixture
            .as("admin")
            .mutation(plan, {
              promotionId: made.id,
              slug: nf,
              sources,
              targets,
            })
            .pipe(Effect.flip);
        const toTakenName: typeof PromotionDestination.Type = {
          kind: "cohort",
          name: "8c",
        };
        const sourcesToTakenName = [
          { cohortId: s.seventh.id, homeroom: true, to: toTakenName },
          base.sources[1],
        ];
        const refusals = yield* Effect.all([
          attempt([...base.targets, { grade: 8, name: "8a" }]),
          attempt([{ grade: 8, name: "8c" }], sourcesToTakenName),
          attempt(
            Arr.makeBy(COHORT_LIMIT + 1, (index) => ({
              grade: 1,
              name: `Kelas ${index}`,
            }))
          ),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "CohortNameTaken" },
          { _tag: "CohortNameTaken" },
          { _tag: "PromotionPlanInvalid", reason: "targets" },
        ]);
      })
  );

  it.effect("sends an approved plan back to draft when it is edited", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      const base = scenarioPlan(s.seventh, s.ninth);
      yield* fixture
        .as("admin")
        .mutation(plan, { promotionId: made.id, slug: nf, ...base });
      yield* fixture
        .as("admin")
        .mutation(promotion.review.submit, { promotionId: made.id, slug: nf });
      yield* fixture
        .as("principal")
        .mutation(promotion.review.approve, { promotionId: made.id, slug: nf });
      const edited = yield* fixture
        .as("admin")
        .mutation(plan, { promotionId: made.id, slug: nf, ...base });
      expect(edited.state).toBe("draft");
    })
  );
});
