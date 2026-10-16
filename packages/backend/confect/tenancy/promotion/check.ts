import type { GenericId } from "@confect/core";
import type {
  TenantCohortsDoc,
  TenantPromotionMovesDoc,
  TenantPromotionsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import {
  CohortNameTaken,
  PromotionPlanInvalid,
  type PromotionPlanIssue,
} from "@repo/backend/confect/tenancy/errors";
import {
  destinationIssue,
  lastGradeOf,
} from "@repo/backend/confect/tenancy/promotion/destination";
import { PROMOTION_PAGE_SIZE } from "@repo/backend/confect/tenancy/promotion/progress";
import type {
  PromotionSource,
  PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion/schema";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Why a source entry does not fit its cohort. A homeroom teacher moves only to a
 * named cohort: a graduating cohort has none, and a repeated year's teacher is
 * assigned by hand, so the copy always has a cohort of the plan to join.
 */
const sourceIssue = (
  targets: readonly (typeof PromotionTarget.Type)[],
  cohort: Pick<TenantCohortsDoc, "grade" | "name">,
  source: typeof PromotionSource.Type,
  lastGrade: Option.Option<number>
): Option.Option<typeof PromotionPlanIssue.Type> => {
  if (source.homeroom && source.to.kind !== "cohort") {
    return Option.some("homeroom");
  }
  return destinationIssue(targets, cohort, source.to, lastGrade);
};

/**
 * Checks a whole plan against its source period as it stands now. The targets are
 * few enough and their names differ, and each cohort of the source period has
 * exactly one source entry, every entry names a cohort of that period, and every
 * destination fits its cohort. Reads the period's cohorts and its unit once each.
 */
export const checkPlan = Effect.fn("tenancy.promotion.check.plan")(
  function* (plan: {
    readonly sourcePeriodId: GenericId.GenericId<"tenantPeriods">;
    readonly sources: readonly (typeof PromotionSource.Type)[];
    readonly targets: readonly (typeof PromotionTarget.Type)[];
    readonly unitId: GenericId.GenericId<"tenantUnits">;
  }) {
    if (plan.targets.length > COHORT_LIMIT) {
      return yield* new PromotionPlanInvalid({ reason: "targets" });
    }
    const names = Arr.map(plan.targets, (target) => cohortNameKey(target.name));
    if (Arr.dedupe(names).length !== names.length) {
      return yield* new CohortNameTaken();
    }
    const reader = yield* DatabaseReader;
    const unit = yield* reader
      .table("tenantUnits")
      .get(plan.unitId)
      .pipe(Effect.orDie);
    const cohorts = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", plan.sourcePeriodId)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);
    // Every cohort has a source entry, and there are as many entries as cohorts, so
    // each entry names a cohort of the period, and each cohort has exactly one entry.
    const covered = Arr.every(cohorts, (cohort) =>
      Arr.some(plan.sources, (source) => source.cohortId === cohort._id)
    );
    if (plan.sources.length !== cohorts.length || !covered) {
      return yield* new PromotionPlanInvalid({ reason: "sources" });
    }
    const lastGrade = lastGradeOf(unit.level);
    yield* Effect.forEach(
      plan.sources,
      (source) =>
        Effect.gen(function* () {
          // The cover check above names a cohort of the period for every source.
          const cohort = yield* Effect.fromOption(
            Arr.findFirst(cohorts, (found) => found._id === source.cohortId)
          ).pipe(Effect.orDie);
          const issue = sourceIssue(plan.targets, cohort, source, lastGrade);
          if (Option.isSome(issue)) {
            return yield* new PromotionPlanInvalid({ reason: issue.value });
          }
        }),
      { discard: true }
    );
  }
);

/**
 * Checks one student's move as `setMove` checks it, against the student's cohort in
 * the source period. A student with no placement there holds no move to a cohort, so
 * the check skips them.
 */
const checkMove = Effect.fn("tenancy.promotion.check.move")(function* (
  promotion: TenantPromotionsDoc,
  lastGrade: Option.Option<number>,
  move: Pick<TenantPromotionMovesDoc, "personId" | "to">
) {
  const placed = yield* placementOf(promotion.sourcePeriodId, move.personId);
  if (Option.isNone(placed)) {
    return;
  }
  const cohort = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(placed.value.cohortId)
    .pipe(Effect.orDie);
  if (
    Option.isSome(
      destinationIssue(promotion.targets, cohort, move.to, lastGrade)
    )
  ) {
    return yield* new PromotionPlanInvalid({ reason: "moves" });
  }
});

/**
 * Checks every move of the promotion, one page at a time through the moves index. A
 * promotion holds at most PROMOTION_MOVE_LIMIT moves, so the pages read a bounded set.
 */
const checkMovesOf = Effect.fn("tenancy.promotion.check.movesOf")(function* (
  promotion: TenantPromotionsDoc,
  lastGrade: Option.Option<number>
) {
  let cursor: string | null = null;
  let done = false;
  yield* Effect.whileLoop({
    while: () => !done,
    body: () =>
      Effect.gen(function* () {
        const page = yield* (yield* DatabaseReader)
          .table("tenantPromotionMoves")
          .index("by_promotionId_and_personId", (query) =>
            query.eq("promotionId", promotion._id)
          )
          .paginate({ cursor, numItems: PROMOTION_PAGE_SIZE })
          .pipe(Effect.orDie);
        yield* Effect.forEach(
          page.page,
          (move) => checkMove(promotion, lastGrade, move),
          { discard: true }
        );
        return page;
      }),
    step: (page) => {
      cursor = page.continueCursor;
      done = page.isDone;
    },
  });
});

/**
 * Refuses a plan that holds a student's move to a target the plan no longer has, with
 * the reason `moves`. A plan edit that removes a target leaves its moves as they are,
 * so the learner fixes them before the plan is submitted. Each move is checked with
 * the cohort it starts from, so its check reads one placement and one cohort.
 */
export const checkMoves = Effect.fn("tenancy.promotion.check.moves")(function* (
  promotion: TenantPromotionsDoc
) {
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(promotion.unitId)
    .pipe(Effect.orDie);
  yield* checkMovesOf(promotion, lastGradeOf(unit.level));
});
