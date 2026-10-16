import type {
  TenantCohortsDoc,
  TenantPeriodsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import {
  CohortLimit,
  CohortNameTaken,
} from "@repo/backend/confect/tenancy/errors";
import { Array as Arr, Effect, Option } from "effect";

/** The period that new cohorts join, as the writes read it. */
type CohortPeriod = Pick<TenantPeriodsDoc, "_id" | "tenantId" | "unitId">;

/** A cohort to create, by the name and grade its creator gives it. */
type NewCohort = Pick<TenantCohortsDoc, "grade" | "name">;

/**
 * Refuses a name that a cohort of the period already has, compared without regard
 * to case. Each name is one indexed read.
 */
export const cohortNamesFree = Effect.fn("tenancy.write.cohort.namesFree")(
  function* (periodId: TenantPeriodsDoc["_id"], cohorts: readonly NewCohort[]) {
    const reader = yield* DatabaseReader;
    const existing = yield* Effect.forEach(cohorts, (cohort) =>
      reader
        .table("tenantCohorts")
        .index("by_periodId_and_nameKey", (query) =>
          query
            .eq("periodId", periodId)
            .eq("nameKey", cohortNameKey(cohort.name))
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
 * Checks that new cohorts fit a period: their names are free, and the period still has
 * room for them under COHORT_LIMIT. It reads only, so a step that inserts several
 * cohorts checks all of them before its first insert.
 */
export const checkCohorts = Effect.fn("tenancy.write.cohort.check")(function* (
  period: Pick<TenantPeriodsDoc, "_id">,
  cohorts: readonly NewCohort[]
) {
  yield* cohortNamesFree(period._id, cohorts);
  const existing = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .index("by_periodId_and_grade_and_nameKey", (query) =>
      query.eq("periodId", period._id)
    )
    .take(COHORT_LIMIT)
    .pipe(Effect.orDie);
  if (existing.length + cohorts.length > COHORT_LIMIT) {
    return yield* new CohortLimit();
  }
});

/**
 * Inserts one active cohort in a period and journals its creation. Returns the cohort
 * it created. Call `checkCohorts` first.
 */
export const insertCohort = Effect.fn("tenancy.write.cohort.insert")(function* (
  actor: typeof TenantActor.Type,
  period: CohortPeriod,
  cohort: NewCohort
) {
  const reader = yield* DatabaseReader;
  const cohortId = yield* (yield* DatabaseWriter)
    .table("tenantCohorts")
    .insert({
      grade: cohort.grade,
      name: cohort.name,
      nameKey: cohortNameKey(cohort.name),
      periodId: period._id,
      status: "active",
      tenantId: period.tenantId,
      unitId: period.unitId,
    })
    .pipe(Effect.orDie);
  const row = yield* reader
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(Effect.orDie);
  yield* cohortAuthority.record(actor, row, { type: "cohort.created" });
  return row;
});
