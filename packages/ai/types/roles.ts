import { Schema } from "effect";

/** Shared user-role vocabulary used by persisted users and AI prompt context. */
export const userRoles = [
  "teacher",
  "student",
  "parent",
  "administrator",
] as const;

/** Runtime prompt role contract used by Nina and specialist prompt context. */
export const PromptUserRoleSchema = Schema.Literal(...userRoles);

export type PromptUserRole = Schema.Schema.Type<typeof PromptUserRoleSchema>;
