import { describe, expect, it } from "@effect/vitest";
import type { BillingAccountId } from "@repo/backend/confect/billing/accounts";
import {
  applySubscriptionState,
  type BillingSubscriptionState,
  readSubscription,
} from "@repo/backend/confect/billing/subscriptions";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

/** Inserts one person's account and returns its ID. */
async function insertAccount(
  ctx: Parameters<
    Parameters<ReturnType<typeof createBillingTestConvex>["run"]>[0]
  >[0]
): Promise<BillingAccountId> {
  const userId = await ctx.db.insert("users", {
    authId: "auth-billing-subscription",
    credits: 0,
    creditsResetAt: 0,
    email: "billing-subscription@example.com",
    mascot: MASCOT_CODE,
    name: "Billing Subscription",
    plan: "free",
  });
  return ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: "polar",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
}

/** One polar subscription state with the fields a test changes. */
function polarState(
  accountId: BillingAccountId,
  overrides: Partial<BillingSubscriptionState> = {}
): BillingSubscriptionState {
  return {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: "active",
    currentPeriodStart: 1000,
    currentPeriodEnd: 2000,
    cancelAtPeriodEnd: false,
    provider: {
      kind: "polar",
      subscriptionId: "sub_polar_1",
      productId: "prod_polar_1",
      priceId: null,
    },
    providerUpdatedAt: 10,
    ...overrides,
  };
}

describe("billing/subscriptions", () => {
  it("inserts a new subscription and updates the same row when a newer state arrives", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const accountId = await insertAccount(ctx);
      const created = await runInMutation(
        ctx,
        applySubscriptionState(polarState(accountId))
      );
      const updated = await runInMutation(
        ctx,
        applySubscriptionState(
          polarState(accountId, {
            status: "pastDue",
            providerUpdatedAt: 20,
          })
        )
      );
      const stored = await ctx.db.query("billingSubscriptions").collect();
      return {
        createdKind: created.kind,
        sameRow: created.subscriptionId === updated.subscriptionId,
        status: stored[0]?.status,
        rows: stored.length,
        updatedKind: updated.kind,
      };
    });
    expect(result).toEqual({
      createdKind: "applied",
      rows: 1,
      sameRow: true,
      status: "pastDue",
      updatedKind: "applied",
    });
  });

  it("refuses a state older than the stored provider time", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const accountId = await insertAccount(ctx);
      await runInMutation(
        ctx,
        applySubscriptionState(polarState(accountId, { providerUpdatedAt: 50 }))
      );
      const late = await runInMutation(
        ctx,
        applySubscriptionState(
          polarState(accountId, { status: "canceled", providerUpdatedAt: 40 })
        )
      );
      const stored = await ctx.db.query("billingSubscriptions").first();
      return { kind: late.kind, status: stored?.status };
    });
    expect(result).toEqual({ kind: "stale", status: "active" });
  });

  it("finds a Xendit subscription by its plan ID", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const accountId = await insertAccount(ctx);
      const xendit = polarState(accountId, {
        provider: {
          kind: "xendit",
          planId: "repl_1",
          tokenId: "pt_1",
        },
      });
      const first = await runInMutation(ctx, applySubscriptionState(xendit));
      const second = await runInMutation(
        ctx,
        applySubscriptionState({
          ...xendit,
          status: "ended",
          providerUpdatedAt: 99,
        })
      );
      return {
        rows: (await ctx.db.query("billingSubscriptions").collect()).length,
        sameRow: first.subscriptionId === second.subscriptionId,
      };
    });
    expect(result).toEqual({ rows: 1, sameRow: true });
  });

  it("reads a subscription by ID and returns null once it is gone", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const accountId = await insertAccount(ctx);
      const applied = await runInMutation(
        ctx,
        applySubscriptionState(polarState(accountId))
      );
      const found = await runInMutation(
        ctx,
        readSubscription(applied.subscriptionId)
      );
      await ctx.db.delete(applied.subscriptionId);
      const missing = await runInMutation(
        ctx,
        readSubscription(applied.subscriptionId)
      );
      return { found: found?.offer, missing };
    });
    expect(result).toEqual({ found: "pro.monthly", missing: null });
  });
});
