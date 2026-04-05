import { internal } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("auth/cleanup", () => {
  it("deletes the user tryout control row with the app user", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "auth-cleanup-control",
      });
    });

    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: identity.userId,
    });

    const result = await t.query(async (ctx) => {
      return {
        control: await ctx.db
          .query("userTryoutControls")
          .withIndex("by_userId", (q) => q.eq("userId", identity.userId))
          .unique(),
        user: await ctx.db.get("users", identity.userId),
      };
    });

    expect(result.user).toBeNull();
    expect(result.control).toBeNull();
  });
});
