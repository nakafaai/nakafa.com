import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  cohortLocked,
  placementOf,
  scopePlace,
} from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Whether a Person may enter a sitting (round 2, decision 1). A unit sitting admits the
 * holders of an active student grant that covers its unit. A cohort sitting admits the
 * Persons placed in its cohort, read through the placement helper of the tenancy lane.
 */
export const mayEnter = Effect.fn("exams.sittings.mayEnter")(function* (
  sitting: ExamSittingsDoc,
  member: Member["Service"]
) {
  if (sitting.cohortId === null) {
    return Arr.some(
      member.grants,
      (grant) =>
        grant.role.key === "student" && covers(grant.scope, [sitting.unitId])
    );
  }
  const cohort = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(sitting.cohortId)
    .pipe(Effect.orDie);
  const placement = yield* placementOf(cohort.periodId, member.person._id);
  return Option.exists(
    placement,
    (found) => found.cohortId === sitting.cohortId
  );
});

/**
 * Whether the cohort of a cohort sitting is locked: its own archive, its period's, or its
 * unit's locks the sitting too. A unit sitting holds no cohort, so no cohort locks it.
 */
export const cohortSittingLocked = Effect.fn("exams.sittings.cohortLocked")(
  function* (row: Pick<ExamSittingsDoc, "cohortId">) {
    if (row.cohortId === null) {
      return false;
    }
    const reader = yield* DatabaseReader;
    const cohort = yield* reader
      .table("tenantCohorts")
      .get(row.cohortId)
      .pipe(Effect.orDie);
    const period = yield* reader
      .table("tenantPeriods")
      .get(cohort.periodId)
      .pipe(Effect.orDie);
    const unit = yield* reader
      .table("tenantUnits")
      .get(cohort.unitId)
      .pipe(Effect.orDie);
    return cohortLocked(cohort, period, unit);
  }
);

/**
 * Whether a sitting is locked for its entries and its learner writes (ADR 0013). Its school is
 * suspended, which refuses every write; its unit is archived, which locks every row placed in it;
 * or it is a cohort sitting whose cohort or period is archived (`cohortSittingLocked`), as the
 * sitting's authority locks it for its staff.
 */
export const sittingLocked = Effect.fn("exams.sittings.locked")(function* (
  sitting: Pick<ExamSittingsDoc, "cohortId" | "tenantId" | "unitId">
) {
  const tenant = yield* (yield* DatabaseReader)
    .table("tenants")
    .get(sitting.tenantId)
    .pipe(Effect.orDie);
  if (tenant.status === "suspended") {
    return true;
  }
  const place = yield* scopePlace({ kind: "unit", unitId: sitting.unitId });
  if (place.locked) {
    return true;
  }
  return yield* cohortSittingLocked(sitting);
});
