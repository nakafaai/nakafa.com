import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * User role options (non-null) - for mutations that set a role
 */
export const userRoleOptionsValidator = v.union(
  v.literal("teacher"),
  v.literal("student"),
  v.literal("parent"),
  v.literal("administrator")
);
export type UserRoleOption = Infer<typeof userRoleOptionsValidator>;

/**
 * User role validator (nullable) - for return types
 */
export const userRoleValidator = v.union(
  v.null(),
  v.literal("teacher"),
  v.literal("student"),
  v.literal("parent"),
  v.literal("administrator")
);
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
 * API key validator (from Better Auth component)
 * Matches the return type of betterAuth.queries.getApiKeysByUserId
 */
export const apiKeyValidator = v.object({
  _creationTime: v.number(),
  _id: v.string(),
  createdAt: v.number(),
  enabled: v.optional(v.union(v.null(), v.boolean())),
  expiresAt: v.optional(v.union(v.null(), v.number())),
  key: v.string(),
  lastRefillAt: v.optional(v.union(v.null(), v.number())),
  lastRequest: v.optional(v.union(v.null(), v.number())),
  metadata: v.optional(v.union(v.null(), v.string())),
  name: v.optional(v.union(v.null(), v.string())),
  permissions: v.optional(v.union(v.null(), v.string())),
  prefix: v.optional(v.union(v.null(), v.string())),
  rateLimitEnabled: v.optional(v.union(v.null(), v.boolean())),
  rateLimitMax: v.optional(v.union(v.null(), v.number())),
  rateLimitTimeWindow: v.optional(v.union(v.null(), v.number())),
  refillAmount: v.optional(v.union(v.null(), v.number())),
  refillInterval: v.optional(v.union(v.null(), v.number())),
  remaining: v.optional(v.union(v.null(), v.number())),
  requestCount: v.optional(v.union(v.null(), v.number())),
  start: v.optional(v.union(v.null(), v.string())),
  updatedAt: v.number(),
  userId: v.string(),
});
export type ApiKey = Infer<typeof apiKeyValidator>;

/**
 * API key verification result validator
 * Matches the return type of betterAuth.mutations.verifyApiKey
 */
export const apiKeyVerifyResultValidator = v.object({
  error: v.union(v.null(), v.object({ code: v.string(), message: v.string() })),
  userId: v.union(v.null(), v.string()),
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
