import { api, components } from "@repo/backend/convex/_generated/api";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import { getStoredCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("users/mutations", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("updates the authenticated user's role", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        role: "student",
      });
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.updateUserRole, {
        role: "teacher",
      });

    const appUser = await t.query(async (ctx) => {
      return await ctx.db.get("users", identity.userId);
    });

    expect(appUser?.role).toBe("teacher");
  });

  it("updates the authenticated user's name in auth and app tables", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, { now: NOW });
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.updateUserName, {
        name: "Nabil Akbarazzima Fatih",
      });

    const result = await t.query(async (ctx) => {
      return {
        authUser: (await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: identity.authUserId }],
        })) as { name: string } | null,
        appUser: await ctx.db.get("users", identity.userId),
      };
    });

    expect(result.authUser?.name).toBe("Nabil Akbarazzima Fatih");
    expect(result.appUser?.name).toBe("Nabil Akbarazzima Fatih");
  });

  it("repairs stale chat credit state when the reset period row is missing", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        credits: -3,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        role: "student",
      });
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.syncUserInfoForChat, {});

    const repairedUser = await t.query(async (ctx) => {
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", identity.userId),
      };
    });
    const storedResetAt = await t.query(async (ctx) => {
      return await getStoredCreditResetTimestamp(ctx.db, "free");
    });

    expect(result).toEqual({
      role: "student",
      credits: 7,
    });
    expect(repairedUser.user?.credits).toBe(7);
    expect(repairedUser.user?.creditsResetAt).toBe(
      Date.UTC(2026, 3, 2, 0, 0, 0)
    );
    expect(repairedUser.creditTransactions).toEqual([
      expect.objectContaining({
        userId: identity.userId,
        amount: 10,
        type: "daily-grant",
        balanceAfter: 7,
      }),
    ]);
    expect(storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
  });

  it("returns current chat credit state without patching when the user is already synced", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      await ctx.db.insert("creditResetPeriods", {
        plan: DEFAULT_USER_PLAN,
        resetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        credits: DEFAULT_USER_CREDITS,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.users.mutations.syncUserInfoForChat, {});

    const appUser = await t.query(async (ctx) => {
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", identity.userId),
      };
    });

    expect(result).toEqual({
      role: null,
      credits: DEFAULT_USER_CREDITS,
    });
    expect(appUser.user?.credits).toBe(DEFAULT_USER_CREDITS);
    expect(appUser.user?.creditsResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
    expect(appUser.creditTransactions).toHaveLength(0);
  });
});
