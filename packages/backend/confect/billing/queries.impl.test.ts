import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  insertPolarAccount,
  insertProSubscription,
  insertTopUpPack,
  PRO_PERIOD_END,
} from "@repo/backend/test/billing";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const NEXT_DAY = Date.UTC(2026, 9, 26);
const NEXT_MONTH = Date.UTC(2026, 10, 1);

/** Seeds a signed-in viewer on `plan` and returns the client that acts as that viewer. */
async function signIn(plan: "free" | "pro") {
  const t = createConvexTestWithBetterAuth();
  const user = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, {
      credits: plan === "pro" ? 1000 : 10,
      now: NOW,
      plan,
      suffix: `overview-${plan}`,
    })
  );
  const authed = t.withIdentity({
    sessionId: user.sessionId,
    subject: user.authUserId,
  });
  return { authed, t, user };
}

describe("billing/queries overview", () => {
  it("shows a free viewer no subscription, the daily allowance, and the next day's reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed } = await signIn("free");
      expect(await authed.query(api.billing.queries.overview, {})).toEqual({
        credits: {
          allowance: 10,
          balance: 10,
          lots: { balance: 0, expiresAt: null },
          pool: null,
          resetAt: NEXT_DAY,
        },
        plan: "free",
        subscription: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a Pro viewer's active subscription with its paid period and its rail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const accountId = await insertPolarAccount(
          ctx,
          user.userId,
          "cust_overview"
        );
        await insertProSubscription(ctx, accountId, {
          subscriptionId: "sub_active",
        });
      });
      expect(await authed.query(api.billing.queries.overview, {})).toEqual({
        credits: {
          allowance: 1000,
          balance: 1000,
          lots: { balance: 0, expiresAt: null },
          pool: null,
          resetAt: NEXT_MONTH,
        },
        plan: "pro",
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: PRO_PERIOD_END,
          currentPeriodStart: PRO_PERIOD_END - 30 * 24 * 60 * 60 * 1000,
          offer: "pro.monthly",
          rail: "polar",
          status: "active",
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a subscription that cancels at the period end with that flag set", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const accountId = await insertPolarAccount(
          ctx,
          user.userId,
          "cust_cancel"
        );
        await insertProSubscription(ctx, accountId, {
          cancelAtPeriodEnd: true,
          subscriptionId: "sub_cancel",
        });
      });
      const overview = await authed.query(api.billing.queries.overview, {});
      expect(overview.subscription?.cancelAtPeriodEnd).toBe(true);
      expect(overview.subscription?.status).toBe("active");
      expect(overview.subscription?.currentPeriodEnd).toBe(PRO_PERIOD_END);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a past-due subscription as past due, so the viewer can fix the payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const accountId = await insertPolarAccount(
          ctx,
          user.userId,
          "cust_past_due"
        );
        await insertProSubscription(ctx, accountId, {
          status: "pastDue",
          subscriptionId: "sub_past_due",
        });
      });
      const overview = await authed.query(api.billing.queries.overview, {});
      expect(overview.subscription?.status).toBe("pastDue");
      expect(overview.plan).toBe("pro");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows no subscription once it has ended, so the viewer sees the upgrade again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("free");
      await t.mutation(async (ctx) => {
        const accountId = await insertPolarAccount(
          ctx,
          user.userId,
          "cust_ended"
        );
        await insertProSubscription(ctx, accountId, {
          status: "ended",
          subscriptionId: "sub_ended",
        });
      });
      const overview = await authed.query(api.billing.queries.overview, {});
      expect(overview.subscription).toBeNull();
      expect(overview.plan).toBe("free");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses the overview to an unauthenticated viewer", async () => {
    const t = createConvexTestWithBetterAuth();
    await expect(t.query(api.billing.queries.overview, {})).rejects.toThrow();
  });

  it("shows the top-up packs a Pro viewer holds: their credits, and the day the first of them ends", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        await insertTopUpPack(ctx, user.userId, {
          expiresAt: NEXT_MONTH,
          providerPaymentId: "order_overview_soon",
          remaining: 600,
        });
        await insertTopUpPack(ctx, user.userId, {
          expiresAt: NEXT_MONTH + 30 * 24 * 60 * 60 * 1000,
          providerPaymentId: "order_overview_late",
          remaining: 1000,
        });
      });
      const overview = await authed.query(api.billing.queries.overview, {});
      expect(overview.credits.lots).toEqual({
        balance: 1600,
        expiresAt: NEXT_MONTH,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a school member the day their school's pool leaves them, which the school's month bounds too", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          country: "ID",
          currency: "IDR",
          kind: "school",
          name: "SMP Pool",
          policies: {
            emailDomains: [],
            nina: true,
            ninaDailyCredits: 40,
            studentThreads: false,
          },
          slug: "smp-pool",
          status: "active",
        });
        await ctx.db.insert("tenantPeople", {
          account: {
            claimedAt: 0,
            method: "card",
            state: "claimed",
            userId: user.userId,
          },
          kind: "member",
          name: "Siswa Pool",
          status: "active",
          tenantId,
        });
        await ctx.db.insert("billingGrants", {
          product: "school",
          tenantId,
          scope: { kind: "tenant" },
          seats: 2,
          ninaSeats: 2,
          source: { kind: "contract", contractId: "contract-pool" },
          validFrom: 0,
          validTo: NEXT_MONTH,
        });
        await ctx.db.insert("creditPools", {
          tenantId,
          month: "2026-10",
          used: 190,
        });
        await ctx.db.insert("creditPoolDays", {
          tenantId,
          userId: user.userId,
          day: "2026-10-25",
          used: 25,
        });
      });
      const overview = await authed.query(api.billing.queries.overview, {});
      expect(overview.credits.pool).toEqual({
        allowance: 40,
        balance: 10,
        resetAt: NEXT_DAY,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
