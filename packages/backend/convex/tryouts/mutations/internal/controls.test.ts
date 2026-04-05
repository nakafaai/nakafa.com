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
      internal.tryouts.mutations.internal.controls.repairOneUserTryoutControl,
      {
        updatedAt: NOW,
        userId,
      }
    );

    const control = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutControls")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
    });

    expect(control?.userId).toBe(userId);
  });

  it("deletes duplicate controls across bounded repair batches", async () => {
    const t = createTryoutTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const createdUserId = await ctx.db.insert("users", {
        authId: "auth-duplicate-control-user",
        credits: 0,
        creditsResetAt: NOW,
        email: "duplicate-control-user@example.com",
        name: "Duplicate Control User",
        plan: "free",
      });

      for (let index = 0; index < 103; index += 1) {
        await ctx.db.insert("userTryoutControls", {
          updatedAt: NOW + index,
          userId: createdUserId,
        });
      }

      return createdUserId;
    });

    const firstRepair = await t.mutation(
      internal.tryouts.mutations.internal.controls.repairOneUserTryoutControl,
      {
        updatedAt: NOW,
        userId,
      }
    );
    const secondRepair = await t.mutation(
      internal.tryouts.mutations.internal.controls.repairOneUserTryoutControl,
      {
        updatedAt: NOW,
        userId,
      }
    );

    const controls = await t.query(async (ctx) => {
      return await ctx.db
        .query("userTryoutControls")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(firstRepair).toMatchObject({
      controlsCreated: 0,
      duplicatesDeleted: 100,
      hasMoreDuplicates: true,
    });
    expect(secondRepair).toMatchObject({
      controlsCreated: 0,
      duplicatesDeleted: 2,
      hasMoreDuplicates: false,
    });
    expect(controls).toHaveLength(1);
    expect(controls[0]?.userId).toBe(userId);
  });
});
