import {
  Building01Icon,
  Building02Icon,
  Building03Icon,
  Building04Icon,
  Building05Icon,
  Building06Icon,
  School01Icon,
} from "@hugeicons/core-free-icons";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option } from "effect";
import { namedOptions } from "@/components/shared/table/filter";
import type { Unit } from "@/components/tenant/settings/state";

/** The icons of the units in a filter, such as a scope's or a level's: buildings, the school itself keeping its own. */
export const UNIT_ICONS = [
  Building01Icon,
  Building02Icon,
  Building03Icon,
  Building04Icon,
  Building05Icon,
  Building06Icon,
] as const;

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
 * Every scope that a grant or a client may cover, as the options of a filter: the school's
 * own name first with the school's icon, then each unit's name once, each unit with a
 * building that no other unit of the menu draws.
 */
export function scopeOptions(
  schoolName: string,
  units: readonly Pick<Unit, "name">[]
) {
  return [
    { icon: School01Icon, label: schoolName, value: schoolName },
    ...namedOptions(
      Arr.filter(
        Arr.dedupe(Arr.map(units, (unit) => unit.name)),
        (name) => name !== schoolName
      ),
      UNIT_ICONS
    ),
  ];
}
