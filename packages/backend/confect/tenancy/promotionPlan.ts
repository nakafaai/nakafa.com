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
  lastGradeOf,
  type PromotionCreated,
  PromotionDestination,
  type PromotionSource,
  type PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion";
import { Array as Arr, Effect, Option } from "effect";

/** A cohort of the source period as the plan reads it. */
type PlannedCohort = Pick<TenantCohortsDoc, "_id" | "grade" | "name">;

/**
 * Why a destination does not fit a cohort of the source period, if it does not.
 * A cohort destination needs a target of that name, `stay` needs a target with
 * the cohort's own name and grade, and graduation needs the cohort's grade to be
 * the last grade of its unit.
 */
export const destinationIssue = (
  targets: readonly (typeof PromotionTarget.Type)[],
  cohort: Pick<PlannedCohort, "grade" | "name">,
  to: typeof PromotionDestination.Type,
  lastGrade: Option.Option<number>
): Option.Option<typeof PromotionPlanIssue.Type> => {
  const issue = (reason: typeof PromotionPlanIssue.Type) => Option.some(reason);
  const none = Option.none<typeof PromotionPlanIssue.Type>();
  return PromotionDestination.match(to, {
    cohort: ({ name }) =>
      Arr.some(
        targets,
        (target) => cohortNameKey(target.name) === cohortNameKey(name)
      )
        ? none
        : issue("destination"),
    graduate: () =>
      Option.exists(lastGrade, (grade) => grade === cohort.grade)
        ? none
        : issue("graduate"),
    stay: () =>
      Arr.some(
        targets,
        (target) =>
          cohortNameKey(target.name) === cohortNameKey(cohort.name) &&
          target.grade === cohort.grade
      )
        ? none
        : issue("stay"),
  });
};

/**
 * Why a source entry does not fit its cohort. A homeroom teacher moves only to a
 * named cohort: a graduating cohort has none, and a repeated year's teacher is
 * assigned by hand, so the copy always has a cohort of the plan to join.
 */
const sourceIssue = (
  targets: readonly (typeof PromotionTarget.Type)[],
  cohort: PlannedCohort,
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
export const checkPlan = Effect.fn("tenancy.promotionPlan.check")(
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
export const targetNamesFree = Effect.fn("tenancy.promotionPlan.namesFree")(
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

/**
 * The cohort of the target period that a destination puts a student of a source
 * cohort in, if it puts them in one. A `stay` destination names the cohort's own
 * name, and graduation puts no one in a cohort.
 */
export const targetOf = (
  created: readonly (typeof PromotionCreated.Type)[],
  to: typeof PromotionDestination.Type,
  sourceName: string
): Option.Option<GenericId.GenericId<"tenantCohorts">> => {
  if (to.kind === "graduate") {
    return Option.none();
  }
  const nameKey = cohortNameKey(to.kind === "cohort" ? to.name : sourceName);
  return Option.map(
    Arr.findFirst(created, (cohort) => cohort.nameKey === nameKey),
    (cohort) => cohort.cohortId
  );
};
