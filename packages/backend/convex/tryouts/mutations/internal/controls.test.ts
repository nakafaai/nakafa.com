import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/mutations/internal/controls", () => {
  it("repairs missing user tryout controls for existing users", async () => {
    const t = createTryoutTestConvex();
    const userId = await t.mutation(async (ctx) => {
      return await ctx.db.insert("users", {
        authId: "auth-existing-user",
        credits: 0,
        creditsResetAt: NOW,
        email: "existing-user@example.com",
        name: "Existing User",
        plan: "free",
      });
    });

    await t.mutation(
      internal.tryouts.mutations.internal.controls.repairUserTryoutControls,
      {}
    );

    const control = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutControls")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
    });

    expect(control?.userId).toBe(userId);
  });
});
