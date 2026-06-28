/** Persisted user roles accepted by the users table and server mutations. */
export const userRoles = [
  "teacher",
  "student",
  "parent",
  "administrator",
] as const;
export type PersistedUserRole = (typeof userRoles)[number];

/** User roles that normal users may choose during onboarding and settings. */
export const selfSelectableUserRoles = [
  "teacher",
  "student",
  "parent",
] as const;
export type SelfSelectableUserRole = (typeof selfSelectableUserRoles)[number];
