import type { GenericId } from "@confect/core";
import type { TenantGrantsDoc } from "@repo/backend/confect/_generated/docs";
import { covers } from "@repo/backend/confect/access/decision";
import { Array as Arr } from "effect";

/**
 * Whether one of these grants is a student grant that covers a unit, over the
 * unit itself or over the whole school. A student reads a class of a unit only
 * while this holds, so revoking the grant ends the class at once. The grants are
 * the caller's active ones, so the check reads nothing.
 */
export function attendsUnit(
  grants: readonly TenantGrantsDoc[],
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return Arr.some(
    grants,
    (grant) => grant.role.key === "student" && covers(grant.scope, [unitId])
  );
}
