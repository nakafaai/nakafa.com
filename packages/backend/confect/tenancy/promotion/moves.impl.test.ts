import { describe, expect, it } from "@effect/vitest";
import type { PromotionDestination } from "@repo/backend/confect/tenancy/promotion/schema";
import {
  nf,
  promotion,
  scenario,
  scenarioPlan,
  toEightA,
  toGraduate,
  toStay,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create, plan } = promotion.draft;
const { moves, setMove } = promotion.moves;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/promotion moves", () => {
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
