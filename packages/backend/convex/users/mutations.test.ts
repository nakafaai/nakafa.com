import { api, components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import { getStoredCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const betterAuthModules = import.meta.glob(["../betterAuth/**/*.ts"]);
const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

function createTestConvex() {
  const t = convexTest(schema, convexModules);
  t.registerComponent("betterAuth", authSchema, betterAuthModules);
  return t;
}

async function seedAuthenticatedUser(
  ctx: MutationCtx,
  overrides?: Partial<{
    credits: number;
    creditsResetAt: number;
    email: string;
    name: string;
    role: "student" | "teacher" | "parent" | "administrator";
  }>
) {
  const name = overrides?.name ?? "Nabil Fatih";
  const email = overrides?.email ?? "nabil@example.com";
  const authUser = (await ctx.runMutation(
    components.betterAuth.adapter.create,
    {
      input: {
        model: "user",
        data: {
          createdAt: NOW,
          email,
          emailVerified: true,
          name,
          updatedAt: NOW,
        },
      },
      select: ["_id", "email", "name"],
    }
  )) as { _id: string; email: string; name: string };
  const session = (await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        createdAt: NOW,
        expiresAt: NOW + 24 * 60 * 60 * 1000,
        token: "test-session-token",
        updatedAt: NOW,
        userId: authUser._id,
      },
    },
    select: ["_id"],
  })) as { _id: string };
  const appUserId = await ctx.db.insert("users", {
    authId: authUser._id,
    email: authUser.email,
    name: authUser.name,
    plan: DEFAULT_USER_PLAN,
    credits: overrides?.credits ?? DEFAULT_USER_CREDITS,
    creditsResetAt: overrides?.creditsResetAt ?? NOW,
    role: overrides?.role,
  });

  return {
    appUserId,
    authUserId: authUser._id,
    sessionId: session._id,
  };
}

describe("users/mutations", () => {
  it("updates the authenticated user's role", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
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
      return await ctx.db.get("users", identity.appUserId);
    });

    expect(appUser?.role).toBe("teacher");
  });

  it("updates the authenticated user's name in auth and app tables", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx);
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
        appUser: await ctx.db.get("users", identity.appUserId),
      };
    });

    expect(result.authUser?.name).toBe("Nabil Akbarazzima Fatih");
    expect(result.appUser?.name).toBe("Nabil Akbarazzima Fatih");
  });

  it("repairs stale chat credit state when the reset period row is missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
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
        user: await ctx.db.get("users", identity.appUserId),
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
        userId: identity.appUserId,
        amount: 10,
        type: "daily-grant",
        balanceAfter: 7,
      }),
    ]);
    expect(storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));

    vi.useRealTimers();
  });

  it("returns current chat credit state without patching when the user is already synced", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      await ctx.db.insert("creditResetPeriods", {
        plan: DEFAULT_USER_PLAN,
        resetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      return await seedAuthenticatedUser(ctx, {
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
        user: await ctx.db.get("users", identity.appUserId),
      };
    });

    expect(result).toEqual({
      role: null,
      credits: DEFAULT_USER_CREDITS,
    });
    expect(appUser.user?.credits).toBe(DEFAULT_USER_CREDITS);
    expect(appUser.user?.creditsResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
    expect(appUser.creditTransactions).toHaveLength(0);

    vi.useRealTimers();
  });
});
