import type { GrantScope } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option } from "effect";
import type { Unit } from "@/components/tenant/settings/state";

/**
 * The name of what a grant or a client covers: the school's name when it covers the
 * whole school, or the name of its unit. A unit the school does not hold has no name,
 * so it shows as empty.
 */
export function scopeNameOf(
  scope: GrantScope,
  schoolName: string,
  units: readonly Pick<Unit, "id" | "name">[]
) {
  if (scope.kind === "tenant") {
    return schoolName;
  }
  return (
    Option.getOrUndefined(
      Arr.findFirst(units, (unit) => unit.id === scope.unitId)
    )?.name ?? ""
  );
}

/**
 * Every name that a grant or a client may cover, in the order a filter lists them: the
 * school's own name first, then each unit's, each once.
 */
export function scopeNames(
  schoolName: string,
  units: readonly Pick<Unit, "name">[]
) {
  return Arr.dedupe([schoolName, ...Arr.map(units, (unit) => unit.name)]);
}
