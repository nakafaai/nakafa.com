import { Table } from "@confect/server";
import { selfSelectableUserRoles, userRoles } from "@repo/utilities/roles";
import { Schema } from "effect";

/**
 * User role options (non-null) - for mutations that set a role
 */
export const userRoleOptionsSchema = Schema.Literal(...userRoles);

/** Roles a normal end user may self-select during onboarding/settings. */
export const selfSelectableUserRoleSchema = Schema.Literal(
  ...selfSelectableUserRoles
);

/**
 * User role validator (nullable) - for return types
 */
export const userRoleSchema = Schema.NullOr(userRoleOptionsSchema);

export type UserRole = Schema.Schema.Type<typeof userRoleSchema>;

/**
 * User plan validator
 * Currently supports: free and pro
 * Can be extended in the future
 */
export const userPlanSchema = Schema.Literal("free", "pro");

export type UserPlan = Schema.Schema.Type<typeof userPlanSchema>;

/**
 * User base validator (without system fields)
 * Used for table definition
 */
export const userSchema = Schema.Struct({
  email: Schema.String,
  authId: Schema.String,
  name: Schema.String,
  image: Schema.optional(Schema.String),
  role: Schema.optional(userRoleOptionsSchema),
  plan: userPlanSchema,
  credits: Schema.Number,
  creditsResetAt: Schema.Number,
});

/** users table definition. */
export const Users = Table.make("users", userSchema)
  .index("by_email", ["email"])
  .index("by_authId", ["authId"]);

export const tables = [Users] as const;
