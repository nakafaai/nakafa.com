import { describe, expect, it } from "@effect/vitest";
import type { PromotionDestination } from "@repo/backend/confect/tenancy/promotion";
import {
  cohort,
  entriesOf,
  nf,
  promotionReview,
  promotions,
  scenario,
  scenarioPlan,
  toEightA,
  toGraduate,
  toStay,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, moves, plan, setMove } = promotions;
const { approve, cancel, submit } = promotionReview;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/promotions plan", () => {
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
            Arr.makeBy(201, (index) => ({ grade: 1, name: `Kelas ${index}` }))
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
        .mutation(submit, { promotionId: made.id, slug: nf });
      yield* fixture
        .as("principal")
        .mutation(approve, { promotionId: made.id, slug: nf });
      const edited = yield* fixture
        .as("admin")
        .mutation(plan, { promotionId: made.id, slug: nf, ...base });
      expect(edited.state).toBe("draft");
    })
  );
});

describe("tenancy/promotions cancelled", () => {
  it.effect("refuses to edit the plan or a move of a cancelled promotion", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      yield* fixture
        .as("admin")
        .mutation(cancel, { promotionId: made.id, slug: nf });
      const planAttempt = yield* fixture
        .as("admin")
        .mutation(plan, {
          promotionId: made.id,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        })
        .pipe(Effect.flip);
      const moveAttempt = yield* fixture
        .as("admin")
        .mutation(setMove, {
          personId: s.first,
          promotionId: made.id,
          slug: nf,
          to: toGraduate,
        })
        .pipe(Effect.flip);
      expect([planAttempt, moveAttempt]).toMatchObject([
        { _tag: "PromotionState" },
        { _tag: "PromotionState" },
      ]);
    })
  );
});

describe("tenancy/promotions moves", () => {
  it.effect(
    "sets, replaces, and clears one student's destination, and lists the moves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          sources: [
            { cohortId: s.seventh.id, homeroom: true, to: toEightA },
            { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
          ],
          targets: [
            { grade: 8, name: "8A" },
            { grade: 7, name: "7A" },
          ],
        });
        const setTo = (to: typeof PromotionDestination.Type | null) =>
          fixture.as("admin").mutation(setMove, {
            personId: s.first,
            promotionId: made.id,
            slug: nf,
            to,
          });
        const withStay = yield* setTo(toStay);
        const listedStay = yield* fixture
          .as("admin")
          .query(moves, { promotionId: made.id, slug: nf, ...firstPage });
        yield* setTo(toEightA);
        const listedCohort = yield* fixture
          .as("admin")
          .query(moves, { promotionId: made.id, slug: nf, ...firstPage });
        yield* setTo(null);
        const listedNone = yield* fixture
          .as("admin")
          .query(moves, { promotionId: made.id, slug: nf, ...firstPage });
        yield* setTo(null);
        expect(withStay.state).toBe("draft");
        expect(listedStay.page).toEqual([{ personId: s.first, to: toStay }]);
        expect(listedCohort.page).toEqual([
          { personId: s.first, to: toEightA },
        ]);
        expect(listedNone.page).toEqual([]);
      })
  );

  it.effect("refuses a student who is not placed in the source period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      const unplaced = yield* fixture
        .as("admin")
        .mutation(setMove, {
          personId: fixture.people.teacher.personId,
          promotionId: made.id,
          slug: nf,
          to: toGraduate,
        })
        .pipe(Effect.flip);
      expect(unplaced).toMatchObject({ _tag: "PersonNotPlaced" });
    })
  );

  it.effect("denies a Person of another school as a foreign object", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      const foreign = yield* fixture
        .as("admin")
        .mutation(setMove, {
          personId: fixture.people.otherOwner.personId,
          promotionId: made.id,
          slug: nf,
          to: toGraduate,
        })
        .pipe(Effect.flip);
      expect(foreign).toMatchObject({
        _tag: "AccessDenied",
        reason: "resource",
      });
    })
  );

  it.effect(
    "refuses a destination that does not fit the cohort the student is in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        const attempt = (
          personId: typeof s.first,
          to: typeof PromotionDestination.Type
        ) =>
          fixture
            .as("admin")
            .mutation(setMove, { personId, promotionId: made.id, slug: nf, to })
            .pipe(Effect.flip);
        const refusals = yield* Effect.all([
          attempt(s.first, { kind: "cohort", name: "Nol" }),
          attempt(s.third, toStay),
          attempt(s.first, toGraduate),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "PromotionPlanInvalid", reason: "destination" },
          { _tag: "PromotionPlanInvalid", reason: "stay" },
          { _tag: "PromotionPlanInvalid", reason: "graduate" },
        ]);
      })
  );
});
