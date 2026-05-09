/** User roles shared by Convex validators and AI prompt context. */
export const userRoles = [
  "teacher",
  "student",
  "parent",
  "administrator",
] as const;
export type UserRole = (typeof userRoles)[number];

/** User roles that normal users may choose from onboarding and settings. */
export const selfSelectableUserRoles = [
  "teacher",
  "student",
  "parent",
] as const;
export type SelfSelectableUserRole = (typeof selfSelectableUserRoles)[number];
