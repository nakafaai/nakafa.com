import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
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
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const cohort = yield* cohortAuthority.lifecycle("cohort.manage", cohortId);
  if (cohort.status !== "archived") {
    return cohort;
  }
  const status: typeof CohortStatus.Type = "active";
  const restored = Struct.assign(cohort, { status });
  yield* cohortAuthority.restorable("cohort.manage", restored);
  yield* (yield* DatabaseWriter)
    .table("tenantCohorts")
    .replace(cohort._id, Struct.omit(restored, ["_creationTime", "_id"]))
    .pipe(Effect.orDie);
  yield* cohortAuthority.record(actor, cohort, { type: "cohort.restored" });
  return restored;
});
