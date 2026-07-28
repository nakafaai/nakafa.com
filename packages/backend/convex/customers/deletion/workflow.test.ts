import { launchDeletedUserCleanupProgram } from "@repo/backend/convex/customers/deletion/workflow";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("customers/deletion/workflow", () => {
  it("starts cleanup for the matching app user", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startAuth = vi.fn(async () => undefined);
    const startCustomer = vi.fn(async () => undefined);
    const startData = vi.fn(async () => undefined);
    const deletedAt = Date.now();

    const user = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "deleted-auth-user",
        credits: 0,
        creditsResetAt: 0,
        deletedAt,
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        authId: "deleted-auth-user",
        finalizedAt: Date.now(),
        recoveryGeneration: 0,
        userId: insertedUserId,
      });

      await runConvexProgram(
        launchDeletedUserCleanupProgram(
          ctx,
          "deleted-auth-user",
          insertedUserId,
          { startAnalytics, startAuth, startCustomer, startData }
        )
      );

      return await ctx.db.get("users", insertedUserId);
    });

    expect(user?.deletionCleanupStartedAt).toEqual(expect.any(Number));
    expect(startAnalytics).toHaveBeenCalledOnce();
    expect(startAuth).toHaveBeenCalledOnce();
    expect(startCustomer).toHaveBeenCalledOnce();
    expect(startData).toHaveBeenCalledOnce();
    const expectedIdentity = {
      authId: "deleted-auth-user",
      userId: user?._id,
    };
    expect(startAnalytics).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
    expect(startAuth).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
    expect(startCustomer).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
    expect(startData).toHaveBeenCalledWith(
      expect.any(Object),
      expectedIdentity
    );
  });

  it("does nothing when the app user is already absent", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startAuth = vi.fn(async () => undefined);
    const startCustomer = vi.fn(async () => undefined);
    const startData = vi.fn(async () => undefined);
    const missingUserId = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "removed-auth-user",
        credits: 0,
        creditsResetAt: 0,
        email: "removed@example.com",
        name: "Removed User",
        plan: "free",
      });
      await ctx.db.delete("users", userId);
      return userId;
    });

    await t.mutation((ctx) =>
      runConvexProgram(
        launchDeletedUserCleanupProgram(
          ctx,
          "missing-auth-user",
          missingUserId,
          { startAnalytics, startAuth, startCustomer, startData }
        )
      )
    );

    expect(startAnalytics).not.toHaveBeenCalled();
    expect(startAuth).not.toHaveBeenCalled();
    expect(startCustomer).not.toHaveBeenCalled();
    expect(startData).not.toHaveBeenCalled();
  });

  it("returns a typed failure when any workflow cannot start", async () => {
    const t = convexTest(schema, convexModules);
    const startAnalytics = vi.fn(async () => undefined);
    const startAuth = vi.fn(async () => undefined);
    const startCustomer = vi.fn(async () => undefined);
    const startData = vi.fn(async () =>
      Promise.reject(new Error("workflow unavailable"))
    );
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failing-auth-user",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: Date.now(),
        email: "failing@example.com",
        name: "Failing User",
        plan: "free",
      })
    );

    await expect(
      t.mutation(
        async (ctx) =>
          await runConvexProgram(
            launchDeletedUserCleanupProgram(ctx, "failing-auth-user", userId, {
              startAnalytics,
              startAuth,
              startCustomer,
              startData,
            })
          )
      )
    ).rejects.toMatchObject({
      data: {
        code: "USER_CLEANUP_FAILED",
        message: "workflow unavailable",
      },
    });

    const user = await t.query(async (ctx) => await ctx.db.get(userId));

    expect(startAnalytics).toHaveBeenCalledOnce();
    expect(startAuth).toHaveBeenCalledOnce();
    expect(startCustomer).toHaveBeenCalledOnce();
    expect(startData).toHaveBeenCalledOnce();
    expect(user).not.toHaveProperty("deletionCleanupStartedAt");
  });
});
