import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

/**
 * User role options (non-null) - for mutations that set a role
 */
export const userRoleOptionsValidator = literals(
  "teacher",
  "student",
  "parent",
  "administrator"
);

/**
 * User role validator (nullable) - for return types
 */
export const userRoleValidator = nullable(userRoleOptionsValidator);
export type UserRole = Infer<typeof userRoleValidator>;

/**
 * User plan validator
 * Currently supports: free and pro
 * Can be extended in the future
 */
export const userPlanValidator = literals("free", "pro");
export type UserPlan = Infer<typeof userPlanValidator>;

/**
 * User base validator (without system fields)
 * Used for table definition
 */
export const userValidator = v.object({
  email: v.string(),
  authId: v.string(),
  name: v.string(),
  image: v.optional(v.string()),
  role: v.optional(userRoleOptionsValidator),
  plan: userPlanValidator,
  credits: v.number(),
  creditsResetAt: v.number(),
});

const tables = {
  users: defineTable(userValidator)
    .index("email", ["email"])
    .index("authId", ["authId"])
    .index("plan", ["plan", "creditsResetAt"]),
};

export default tables;
