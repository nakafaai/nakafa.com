import { getStaticAuth } from "@convex-dev/better-auth";
import { v } from "convex/values";
import { doc } from "convex-helpers/validators";
import { createAuth } from "../auth";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { validatePermissions } from "./utils";

// Export a static instance for Better Auth schema generation
export const auth = getStaticAuth(createAuth);

/**
 * Link Better Auth user to app user.
 * Called when app user is created.
 */
export const setUserId = mutation({
  args: {
    authId: v.id("user"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("user", args.authId, {
      userId: args.userId,
    });
  },
});

/**
 * Update Better Auth user's display name.
 */
export const updateUserName = mutation({
  args: {
    authId: v.id("user"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("user", args.authId, {
      name: args.name,
    });
  },
});

/**
 * Get Better Auth user by email address.
 * Returns null if user doesn't exist.
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(v.null(), doc(schema, "user")),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      return null;
    }

    return user;
  },
});

/**
 * Get API keys by user ID.
 * Returns API keys for the user.
 */
export const getApiKeysByUserId = query({
  args: {
    userId: v.id("user"),
  },
  returns: v.array(doc(schema, "apikey")),
  handler: async (ctx, args) => {
    const apiKeys = await ctx.db
      .query("apikey")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    return apiKeys;
  },
});

/**
 * Verify API Key with comprehensive validation.
 * Handles expiration, rate limiting, remaining count, and refill logic.
 * Permissions should be JSON stringified Record<string, string[]>.
 */
export const verifyApiKey = mutation({
  args: {
    key: v.string(),
    permissions: v.optional(v.string()), // JSON stringified Record<string, string[]>
  },
  returns: v.object({
    valid: v.boolean(),
    userId: v.union(v.null(), v.string()),
    error: v.union(
      v.null(),
      v.object({
        message: v.string(),
        code: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Find the API key
    const apiKey = await ctx.db
      .query("apikey")
      .withIndex("key", (q) => q.eq("key", args.key))
      .unique();

    if (!apiKey) {
      return {
        valid: false,
        userId: null,
        error: { message: "Invalid API key", code: "INVALID_KEY" },
      };
    }

    const now = Date.now();

    // Check enabled status (only true = enabled, everything else = disabled)
    if (apiKey.enabled !== true) {
      return {
        valid: false,
        userId: null,
        error: { message: "API key is disabled", code: "KEY_DISABLED" },
      };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < now) {
      return {
        valid: false,
        userId: null,
        error: { message: "API key has expired", code: "KEY_EXPIRED" },
      };
    }

    // Handle refill logic
    let currentRemaining = apiKey.remaining ?? null;
    if (apiKey.refillInterval && apiKey.refillAmount && apiKey.lastRefillAt) {
      const timeSinceRefill = now - apiKey.lastRefillAt;
      const refillsDue = Math.floor(timeSinceRefill / apiKey.refillInterval);

      if (refillsDue > 0) {
        currentRemaining =
          (currentRemaining ?? 0) + refillsDue * apiKey.refillAmount;
        await ctx.db.patch("apikey", apiKey._id, {
          remaining: currentRemaining,
          lastRefillAt:
            apiKey.lastRefillAt + refillsDue * apiKey.refillInterval,
        });
      }
    }

    // Check remaining count
    if (currentRemaining !== null && currentRemaining <= 0) {
      return {
        valid: false,
        userId: null,
        error: {
          message: "API key has no remaining requests",
          code: "NO_REMAINING_REQUESTS",
        },
      };
    }

    // Handle rate limiting
    if (
      apiKey.rateLimitEnabled &&
      apiKey.rateLimitTimeWindow &&
      apiKey.rateLimitMax
    ) {
      const lastRequest = apiKey.lastRequest ?? 0;
      const requestCount = apiKey.requestCount ?? 0;

      if (now - lastRequest > apiKey.rateLimitTimeWindow) {
        await ctx.db.patch("apikey", apiKey._id, {
          requestCount: 1,
          lastRequest: now,
        });
      } else if (requestCount >= apiKey.rateLimitMax) {
        return {
          valid: false,
          userId: null,
          error: {
            message: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
          },
        };
      } else {
        await ctx.db.patch("apikey", apiKey._id, {
          requestCount: requestCount + 1,
          lastRequest: now,
        });
      }
    } else {
      await ctx.db.patch("apikey", apiKey._id, { lastRequest: now });
    }

    // Decrement remaining count
    if (currentRemaining !== null) {
      await ctx.db.patch("apikey", apiKey._id, {
        remaining: currentRemaining - 1,
      });
    }

    // Verify permissions
    if (args.permissions && apiKey.permissions) {
      const permResult = validatePermissions({
        requiredPerms: args.permissions,
        keyPerms: apiKey.permissions,
      });
      if (!permResult.valid) {
        return {
          valid: false,
          userId: null,
          error: {
            message: permResult.error ?? "Insufficient permissions",
            code: "INSUFFICIENT_PERMISSIONS",
          },
        };
      }
    }

    // Return successful verification
    return {
      valid: true,
      userId: apiKey.userId,
      error: null,
    };
  },
});
