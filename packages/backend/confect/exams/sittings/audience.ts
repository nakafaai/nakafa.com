import type { TenantUnitsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { authorizeScope } from "@repo/backend/confect/tenancy/authority";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr, Effect, Option, Result } from "effect";

/**
 * The active cohorts of one unit's active period: the groups, besides the whole unit,
 * that a sitting of the unit may run for. The caller must be allowed to edit the unit's
 * exams, and a unit with no active period has no cohort to offer.
 */
export const scheduleCohortsOf = Effect.fn("exams.sittings.audience")(
  function* (unitId: TenantUnitsDoc["_id"]) {
    yield* authorizeScope("exam.edit", { kind: "unit", unitId });
    const reader = yield* DatabaseReader;
    const period = yield* reader
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(period)) {
      return [];
    }
    const cohorts = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", period.value._id)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);
    return Arr.filterMap(cohorts, (cohort) =>
      cohort.status === "active"
        ? Result.succeed({ id: cohort._id, name: cohort.name })
        : Result.failVoid
    );
  }
);
