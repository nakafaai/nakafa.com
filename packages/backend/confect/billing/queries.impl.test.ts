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
          resetAt: NEXT_DAY,
        },
        pass: null,
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
          resetAt: NEXT_MONTH,
        },
        pass: null,
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
});

describe("billing/queries proOffers", () => {
  it("sells the monthly plan alone in rupiah on Polar, and the passes beside it once Xendit takes Indonesia", async () => {
    const t = createConvexTestWithBetterAuth();
    try {
      expect(
        await t.query(api.billing.queries.proOffers, { currency: "IDR" })
      ).toEqual([
        { amount: 79_000, currency: "IDR", months: 1, offer: "pro.monthly" },
      ]);
      vi.stubEnv("BILLING_INDONESIA_RAIL", "xendit");
      vi.stubEnv("XENDIT_API_KEY", "test-secret");
      expect(
        await t.query(api.billing.queries.proOffers, { currency: "IDR" })
      ).toEqual([
        { amount: 79_000, currency: "IDR", months: 1, offer: "pro.monthly" },
        { amount: 79_000, currency: "IDR", months: 1, offer: "pro.pass.1" },
        { amount: 229_000, currency: "IDR", months: 3, offer: "pro.pass.3" },
        { amount: 790_000, currency: "IDR", months: 12, offer: "pro.pass.12" },
      ]);
      expect(
        await t.query(api.billing.queries.proOffers, { currency: "USD" })
      ).toEqual([
        { amount: 899, currency: "USD", months: 1, offer: "pro.monthly" },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("billing/queries overview pass", () => {
  it("shows a viewer who holds only a pass the moment it ends, and nothing once a contract gives Pro beside it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const accountId = await ctx.db.insert("billingAccounts", {
          owner: { kind: "personal", userId: user.userId },
          rail: "xendit",
          country: "ID",
          currency: "IDR",
          providerCustomerId: null,
        });
        const paymentId = await ctx.db.insert("billingPayments", {
          kind: "pass",
          accountId,
          status: "succeeded",
          amount: 79_000,
          currency: "IDR",
          rail: "xendit",
          providerPaymentId: "py-overview-pass",
          providerUpdatedAt: NOW,
          method: "session",
          paidAt: NOW,
        });
        await ctx.db.insert("billingGrants", {
          product: "pro",
          userId: user.userId,
          source: { kind: "pass", paymentId },
          validFrom: NOW,
          validTo: NEXT_MONTH,
        });
      });
      expect(
        (await authed.query(api.billing.queries.overview, {})).pass
      ).toEqual({ endsAt: NEXT_MONTH });
      await t.mutation((ctx) =>
        ctx.db.insert("billingGrants", {
          product: "pro",
          userId: user.userId,
          source: { kind: "contract", contractId: "contract-overview" },
          validFrom: NOW,
          validTo: NEXT_MONTH,
        })
      );
      expect(
        (await authed.query(api.billing.queries.overview, {})).pass
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("billing/queries payments", () => {
  it("lists a viewer's payments that went through on both rails newest first, as their receipts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const { authed, t, user } = await signIn("pro");
      await t.mutation(async (ctx) => {
        const polar = await insertPolarAccount(
          ctx,
          user.userId,
          "cust_receipts"
        );
        const xendit = await ctx.db.insert("billingAccounts", {
          owner: { kind: "personal", userId: user.userId },
          rail: "xendit",
          country: "ID",
          currency: "IDR",
          providerCustomerId: null,
        });
        await ctx.db.insert("billingPayments", {
          kind: "credits",
          accountId: polar,
          status: "succeeded",
          amount: 499,
          currency: "USD",
          rail: "polar",
          providerPaymentId: "order_receipts",
          providerUpdatedAt: NOW - 2000,
          method: "polar",
          paidAt: NOW - 2000,
        });
        await ctx.db.insert("billingPayments", {
          kind: "pass",
          accountId: xendit,
          status: "succeeded",
          amount: 229_000,
          currency: "IDR",
          rail: "xendit",
          providerPaymentId: "py_receipts",
          providerUpdatedAt: NOW - 1000,
          method: "session",
          paidAt: NOW - 1000,
        });
        await ctx.db.insert("billingPayments", {
          kind: "pass",
          accountId: xendit,
          status: "refunded",
          amount: 79_000,
          currency: "IDR",
          rail: "xendit",
          providerPaymentId: "py_refunded",
          providerUpdatedAt: NOW - 500,
          method: "session",
          paidAt: NOW - 500,
        });
      });
      expect(await authed.query(api.billing.queries.payments, {})).toEqual([
        {
          amount: 229_000,
          currency: "IDR",
          kind: "pass",
          paidAt: NOW - 1000,
          rail: "xendit",
        },
        {
          amount: 499,
          currency: "USD",
          kind: "credits",
          paidAt: NOW - 2000,
          rail: "polar",
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
