import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { userRoles } from "@repo/backend/confect/users/role";
import { selfSelectableUserRoles } from "@repo/backend/confect/users/roles";
import { Schema } from "effect";

/**
 * User role options (non-null) - for mutations that set a role
 */
const userRoleOptionsValidator = Schema.Literals([...userRoles]);

/** Roles a normal end user may self-select during onboarding/settings. */
export const selfSelectableUserRoleValidator = Schema.Literals([
  ...selfSelectableUserRoles,
]);

/**
 * User role validator (nullable) - for return types
 */
export const userRoleValidator = Schema.NullOr(userRoleOptionsValidator);

/**
 * User plan validator
 * Currently supports: free and pro
 * Can be extended in the future
 */
export const userPlanValidator = Schema.Literals(["free", "pro"]);
export type UserPlan = typeof userPlanValidator.Type;

/**
 * User base validator (without system fields)
 * Used for table definition
 */
export const userValidator = Schema.Struct({
  email: Schema.String,
  authId: Schema.String,
  name: Schema.String,
  image: Schema.optionalKey(Schema.String),
  role: Schema.optionalKey(userRoleOptionsValidator),
  plan: userPlanValidator,
  credits: Schema.Finite,
  creditsResetAt: Schema.Finite,
  // Identifies a balance replacement caused by a subscription plan change.
  planCreditGrantId: Schema.optionalKey(IdSchema("creditTransactions")),
  authVerificationCleanupCursor: Schema.optionalKey(Schema.String),
  deletionCleanupStartedAt: Schema.optionalKey(Schema.Finite),
  deletionPreparedAt: Schema.optionalKey(Schema.Finite),
  deletedAt: Schema.optionalKey(Schema.Finite),
});
