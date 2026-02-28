import { tables as betterAuthTables } from "@repo/backend/convex/betterAuth/generatedSchema";
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
 * User base validator (without system fields)
 * Used for table definition
 */
export const userValidator = v.object({
  email: v.string(),
  authId: v.string(),
  name: v.string(),
  image: v.optional(v.string()),
  role: v.optional(userRoleOptionsValidator),
  credits: v.optional(v.number()),
  creditsResetAt: v.optional(v.number()),
});

/**
 * User device base validator
 */
export const userDeviceValidator = v.object({
  userId: v.id("users"),
  deviceId: v.string(),
  deviceName: v.optional(v.string()),
  lastSeenAt: v.number(),
  isActive: v.boolean(),
});

/**
 * API key validator for cross-component use.
 * When calling betterAuth component queries, IDs are serialized as strings.
 * Derived from betterAuthTables.apikey - single source of truth.
 */
export const apiKeyDocValidator = v.object({
  ...betterAuthTables.apikey.validator.fields,
  _id: v.string(),
  _creationTime: v.number(),
});

/**
 * API key verification result validator
 * Matches the return type of betterAuth.mutations.verifyApiKey
 */
export const apiKeyVerifyResultValidator = v.object({
  error: nullable(v.object({ code: v.string(), message: v.string() })),
  userId: nullable(v.string()),
  valid: v.boolean(),
});

const tables = {
  users: defineTable(userValidator)
    .index("email", ["email"])
    .index("authId", ["authId"])
    .index("creditsResetAt", ["creditsResetAt"]),
  userDevices: defineTable(userDeviceValidator)
    .index("deviceId", ["deviceId"])
    .index("userId_lastSeenAt", ["userId", "lastSeenAt"])
    .index("userId_isActive", ["userId", "isActive"]),
};

export default tables;
