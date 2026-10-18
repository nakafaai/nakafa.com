import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
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
