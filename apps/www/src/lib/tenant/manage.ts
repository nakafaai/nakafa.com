import { Array as Arr } from "effect";

/**
 * Whether the viewer may manage the school, which the school's settings and its setup need. It reads only the
 * viewer's actions, so a route's guard asks it without loading the school's schemas into every first load.
 */
export function canManageSchool(can: readonly string[]): boolean {
  return Arr.contains(can, "tenant.manage");
}
