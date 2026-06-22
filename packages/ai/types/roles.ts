import { Schema } from "effect";

/**
 * User-role vocabulary accepted by AI prompt context.
 *
 * This is a prompt projection, not the persistence source of truth. Backend
 * tests keep it aligned with persisted user roles without making AI depend on
 * the backend package.
 */
export const promptUserRoles = [
  "teacher",
  "student",
  "parent",
  "administrator",
] as const;

/** Runtime prompt role contract used by Nina and specialist prompt context. */
export const PromptUserRoleSchema = Schema.Literal(...promptUserRoles);

export type PromptUserRole = Schema.Schema.Type<typeof PromptUserRoleSchema>;
