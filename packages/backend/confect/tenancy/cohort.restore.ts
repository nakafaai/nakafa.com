import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import type { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import { Effect, Struct } from "effect";

/**
 * Restores one archived cohort to active, the inverse of archiving it. An archived cohort refuses
 * every action on its own row, so the school's Admin restores it at the school level. The cohort
 * must belong to the school, and its period and unit must be open, because either one being
 * archived locks the cohort again. A cohort keeps its name while it is archived, so no other cohort
 * of the period can hold that name. A cohort that is active changes nothing.
 */
export const restoreCohort = Effect.fn("tenancy.cohort.restore")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const reader = yield* DatabaseReader;
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () =>
          new AccessDenied({ action: "cohort.manage", reason: "resource" }),
      })
    );
  if (cohort.tenantId !== tenantId) {
    return yield* new AccessDenied({
      action: "cohort.manage",
      reason: "resource",
    });
  }
  if (cohort.status !== "archived") {
    return cohort;
  }
  const period = yield* reader
    .table("tenantPeriods")
    .get(cohort.periodId)
    .pipe(Effect.orDie);
  const unit = yield* reader
    .table("tenantUnits")
    .get(cohort.unitId)
    .pipe(Effect.orDie);
  if (period.status === "archived" || unit.status === "archived") {
    return yield* new AccessDenied({
      action: "cohort.manage",
      reason: "condition",
    });
  }
  const status: typeof CohortStatus.Type = "active";
  const restored = Struct.assign(cohort, { status });
  yield* (yield* DatabaseWriter)
    .table("tenantCohorts")
    .replace(
      cohort._id,
      Struct.assign(Struct.omit(cohort, ["_creationTime", "_id"]), { status })
    )
    .pipe(Effect.orDie);
  yield* cohortAuthority.record(actor, cohort, { type: "cohort.restored" });
  return restored;
});
