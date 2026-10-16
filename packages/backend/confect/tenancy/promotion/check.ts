import type { GenericId } from "@confect/core";
import type { TenantCohortsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
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
 * Refuses a plan whose new cohort names a cohort of the target period already has,
 * compared without regard to case. Each name is one indexed read.
 */
export const targetNamesFree = Effect.fn("tenancy.promotion.check.namesFree")(
  function* (
    targetPeriodId: GenericId.GenericId<"tenantPeriods">,
    targets: readonly (typeof PromotionTarget.Type)[]
  ) {
    const reader = yield* DatabaseReader;
    const existing = yield* Effect.forEach(targets, (target) =>
      reader
        .table("tenantCohorts")
        .index("by_periodId_and_nameKey", (query) =>
          query
            .eq("periodId", targetPeriodId)
            .eq("nameKey", cohortNameKey(target.name))
        )
        .first()
        .pipe(Effect.orDie)
    );
    if (Arr.some(existing, Option.isSome)) {
      return yield* new CohortNameTaken();
    }
  }
);
