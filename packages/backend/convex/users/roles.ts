/** User roles that normal users may choose during onboarding and settings. */
export const selfSelectableUserRoles = [
  "teacher",
  "student",
  "parent",
] as const;
export type SelfSelectableUserRole = (typeof selfSelectableUserRoles)[number];

/** Narrows a persisted role to the roles an end user may select for themself. */
export function isSelfSelectableUserRole(
  role: string | undefined
): role is SelfSelectableUserRole {
  return role === "parent" || role === "student" || role === "teacher";
}
