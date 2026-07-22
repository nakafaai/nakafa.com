import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 22, 8, 0, 0);

describe("auth/cleanup", () => {
  it("deletes the lifetime free claim with the local user", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "deleted-auth-user",
        credits: 10,
        creditsResetAt: NOW,
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
      });
      await ctx.db.insert("notificationPreferences", {
        disabledTypes: [],
        emailDigest: "weekly",
        emailEnabled: true,
        userId,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: NOW,
        countryKey: "indonesia",
        examKey: "snbt",
        setKey: "set-1",
        trackKey: "2027",
        userId,
      });

      await ctx.runMutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId,
      });

      return {
        claims: await ctx.db
          .query("tryoutFreeAttemptClaims")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        preferences: await ctx.db
          .query("notificationPreferences")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        user: await ctx.db.get("users", userId),
      };
    });

    expect(result).toEqual({ claims: [], preferences: [], user: null });
  });
});
