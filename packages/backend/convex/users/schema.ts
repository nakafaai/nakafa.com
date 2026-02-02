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
export type UserRoleOption = Infer<typeof userRoleOptionsValidator>;

/**
 * User role validator (nullable) - for return types
 */
export const userRoleValidator = nullable(userRoleOptionsValidator);
export type UserRole = Infer<typeof userRoleValidator>;

/**
 * User base validator (without system fields)
 * Used for table definition and as base for document validator
 */
export const userValidator = v.object({
  email: v.string(),
  authId: v.string(),
  name: v.string(),
  image: v.optional(v.string()),
  role: v.optional(userRoleOptionsValidator),
});

/**
 * User document validator (with system fields)
 * Used for return types in queries/mutations
 */
export const userDocValidator = userValidator.extend({
  _id: v.id("users"),
  _creationTime: v.number(),
});
export type UserDoc = Infer<typeof userDocValidator>;

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
 * User device document validator
 */
export const userDeviceDocValidator = userDeviceValidator.extend({
  _id: v.id("userDevices"),
  _creationTime: v.number(),
});
export type UserDeviceDoc = Infer<typeof userDeviceDocValidator>;

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
export type ApiKeyDoc = Infer<typeof apiKeyDocValidator>;

/**
 * API key verification result validator
 * Matches the return type of betterAuth.mutations.verifyApiKey
 */
export const apiKeyVerifyResultValidator = v.object({
  error: nullable(v.object({ code: v.string(), message: v.string() })),
  userId: nullable(v.string()),
  valid: v.boolean(),
});
export type ApiKeyVerifyResult = Infer<typeof apiKeyVerifyResultValidator>;

const tables = {
  users: defineTable(userValidator)
    .index("email", ["email"])
    .index("authId", ["authId"]),
  userDevices: defineTable(userDeviceValidator)
    .index("deviceId", ["deviceId"])
    .index("userId_lastSeenAt", ["userId", "lastSeenAt"])
    .index("userId_isActive", ["userId", "isActive"]),
};

export default tables;
