/** User roles that normal users may choose during onboarding and settings. */
export const selfSelectableUserRoles = [
  "teacher",
  "student",
  "parent",
] as const;
export type SelfSelectableUserRole = (typeof selfSelectableUserRoles)[number];
