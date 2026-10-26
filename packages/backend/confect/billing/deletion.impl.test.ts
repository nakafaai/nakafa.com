import { beforeEach, describe, expect, it } from "@effect/vitest";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import { XenditRequestFailed } from "@repo/backend/confect/billing/xendit/client";
import { ensurePlanInactive } from "@repo/backend/confect/billing/xendit/plans";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  deleteCustomer: vi.fn(),
  getCustomerByExternalId: vi.fn(),
}));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));
vi.mock(
  "@repo/backend/confect/billing/xendit/plans",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@repo/backend/confect/billing/xendit/plans")
      >();
    return { ...actual, ensurePlanInactive: vi.fn() };
  }
);
vi.mock("@repo/backend/confect/billing/accounts", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/backend/confect/billing/accounts")
    >();
  return { ...actual, findAccount: vi.fn(actual.findAccount) };
});

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

beforeEach(() => {
  vi.resetAllMocks();
  polarGateway.deleteCustomer.mockReturnValue(Effect.succeed(null));
  polarGateway.getCustomerByExternalId.mockReturnValue(Effect.succeed(null));
  vi.mocked(ensurePlanInactive).mockReturnValue(Effect.succeed(null));
});

/** Inserts one user with a Polar account and a subscription, the rows a deletion removes. */
async function seedDeletingUser(
  ctx: MutationCtx,
  providerCustomerId: string | null = "cust_deleted"
) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-billing-deletion",
    credits: 0,
    creditsResetAt: NOW,
    deletedAt: NOW,
    email: "deleted@example.com",
    mascot: MASCOT_CODE,
    name: "Deleted",
    plan: "pro",
  });
  const accountId = await insertPolarAccount(ctx, userId, providerCustomerId);
  await insertProSubscription(ctx, accountId, {
    subscriptionId: "sub_deleted",
  });
  await ctx.db.insert("billingGrants", {
    product: "pro",
    source: { kind: "contract", contractId: "contract-deleted" },
    userId,
    validFrom: NOW,
    validTo: NOW + 1000,
  });
  return { accountId, userId };
}

/** Inserts one Xendit account and one Xendit subscription on it, the rows a Xendit deletion removes. */
async function seedXenditUser(ctx: MutationCtx, planId: string) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-xendit-${planId}`,
    credits: 0,
    creditsResetAt: NOW,
    deletedAt: NOW,
    email: `${planId}@example.com`,
    mascot: MASCOT_CODE,
    name: "Xendit Deleted",
    plan: "pro",
  });
  const accountId = await ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: "xendit",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
  await ctx.db.insert("billingSubscriptions", {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: "active",
    currentPeriodStart: NOW,
    currentPeriodEnd: NOW + 1000,
    cancelAtPeriodEnd: false,
    provider: { kind: "xendit", planId, tokenId: null },
    providerUpdatedAt: NOW,
  });
  return { accountId, userId };
}

describe("billing/deletion", () => {
  it("reads the personal accounts of a user on each rail, with their provider customers", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const seeded = await seedDeletingUser(ctx);
      await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId: seeded.userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      return seeded.userId;
    });
    const accounts = await t.query(internal.billing.deletion.readAccounts, {
      userId,
    });
    expect(accounts).toMatchObject([
      { rail: "polar", providerCustomerId: "cust_deleted" },
      { rail: "xendit", providerCustomerId: null },
    ]);
  });

  it("reads the subscriptions of a user with the Xendit plan each one bills through", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const seeded = await seedDeletingUser(ctx);
      const xendit = await seedXenditUser(ctx, "plan_listed");
      return { polar: seeded.userId, xendit: xendit.userId };
    });
    const polar = await t.query(internal.billing.deletion.readSubscriptions, {
      userId: userId.polar,
    });
    expect(polar).toMatchObject([{ xenditPlanId: null }]);
    const xendit = await t.query(internal.billing.deletion.readSubscriptions, {
      userId: userId.xendit,
    });
    expect(xendit).toMatchObject([{ xenditPlanId: "plan_listed" }]);
  });

  it("deletes the Polar customer, then every billing row of the user", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx)).userId
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-billing-deletion",
      userId,
    });
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith("cust_deleted");
    const stored = await t.run(async (ctx) => ({
      accounts: await ctx.db.query("billingAccounts").collect(),
      grants: await ctx.db.query("billingGrants").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(stored).toEqual({ accounts: [], grants: [], subscriptions: [] });
  });

  it("looks up the Polar customer by the user's auth ID when no account links one, and erases it", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx, null)).userId
    );
    polarGateway.getCustomerByExternalId.mockReturnValue(
      Effect.succeed({
        billingCountry: null,
        email: null,
        externalId: "auth-billing-deletion",
        id: "cust_by_auth",
        name: null,
      })
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-billing-deletion",
      userId,
    });
    expect(polarGateway.getCustomerByExternalId).toHaveBeenCalledWith(
      "auth-billing-deletion"
    );
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith("cust_by_auth");
  });

  it("deletes no Polar customer for an account that never linked one, when Polar holds none under the auth ID", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx, null)).userId
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-billing-deletion",
      userId,
    });
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toEqual([]);
  });

  it("turns off a Xendit plan before its rows are deleted", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedXenditUser(ctx, "plan_turned_off")).userId
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-xendit-plan_turned_off",
      userId,
    });
    expect(ensurePlanInactive).toHaveBeenCalledWith("plan_turned_off");
    expect(
      await t.run((ctx) => ctx.db.query("billingSubscriptions").collect())
    ).toEqual([]);
  });

  it("keeps a Xendit subscription and its account when Xendit cannot turn its plan off", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedXenditUser(ctx, "plan_stuck")).userId
    );
    vi.mocked(ensurePlanInactive).mockReturnValue(
      Effect.fail(
        new XenditRequestFailed({
          errorCode: "SERVER_ERROR",
          message: "Xendit is down.",
          status: 500,
        })
      )
    );
    await expect(
      t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
        authId: "auth-xendit-plan_stuck",
        userId,
      })
    ).rejects.toThrow();
    const stored = await t.run(async (ctx) => ({
      accounts: await ctx.db.query("billingAccounts").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(stored.accounts).toHaveLength(1);
    expect(stored.subscriptions).toHaveLength(1);
  });

  it("keeps a subscription that arrived after its batch was read until its plan is turned off", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx, null)).userId
    );
    const listed = await t.query(internal.billing.deletion.readSubscriptions, {
      userId,
    });
    await t.mutation(async (ctx) => {
      const account = await ctx.db.query("billingAccounts").first();
      if (account === null) {
        throw new Error("the seeded account is missing");
      }
      await insertProSubscription(ctx, account._id, {
        subscriptionId: "sub_arrived_late",
      });
    });
    const remaining = await t.mutation(internal.billing.deletion.deleteRows, {
      subscriptionIds: Arr.map(listed, (row) => row.subscriptionId),
      userId,
    });
    expect(remaining).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("billingSubscriptions").collect())
    ).toMatchObject([{ provider: { subscriptionId: "sub_arrived_late" } }]);
  });

  it("deletes only the listed subscriptions that belong to the user's accounts", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const mine = await seedDeletingUser(ctx, null);
      const other = await seedXenditUser(ctx, "plan_other_user");
      const mySubscription = await ctx.db
        .query("billingSubscriptions")
        .filter((q) => q.eq(q.field("accountId"), mine.accountId))
        .first();
      const otherSubscription = await ctx.db
        .query("billingSubscriptions")
        .filter((q) => q.eq(q.field("accountId"), other.accountId))
        .first();
      if (mySubscription === null || otherSubscription === null) {
        throw new Error("the seeded subscriptions are missing");
      }
      return {
        mine: mine.userId,
        mySubscription: mySubscription._id,
        otherSubscription: otherSubscription._id,
      };
    });
    const remaining = await t.mutation(internal.billing.deletion.deleteRows, {
      subscriptionIds: [ids.mySubscription, ids.otherSubscription],
      userId: ids.mine,
    });
    expect(remaining).toBe(false);
    expect(
      await t.run((ctx) => ctx.db.query("billingSubscriptions").collect())
    ).toMatchObject([{ provider: { planId: "plan_other_user" } }]);
  });

  it("skips a listed subscription that no longer exists", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const seeded = await seedDeletingUser(ctx, null);
      const subscription = await ctx.db.query("billingSubscriptions").first();
      if (subscription === null) {
        throw new Error("the seeded subscription is missing");
      }
      await ctx.db.delete(subscription._id);
      return { gone: subscription._id, userId: seeded.userId };
    });
    const remaining = await t.mutation(internal.billing.deletion.deleteRows, {
      subscriptionIds: [ids.gone],
      userId: ids.userId,
    });
    expect(remaining).toBe(false);
  });

  it("clears a long payment history in bounded batches until its last batch", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const seeded = await seedDeletingUser(ctx, null);
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("billingPayments", {
          accountId: seeded.accountId,
          amount: 1,
          currency: "USD",
          kind: "pass",
          method: "card",
          paidAt: NOW + index,
          providerPaymentId: `pay_${index}`,
          providerUpdatedAt: NOW,
          rail: "polar",
          status: "succeeded",
        });
      }
      return seeded.userId;
    });
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-billing-deletion",
      userId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("billingPayments").collect())
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toEqual([]);
  });

  it("reports that rows remain while a batch is full", async () => {
    const t = createBillingTestConvex();
    const { accountId, userId } = await t.mutation((ctx) =>
      seedDeletingUser(ctx, null)
    );
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        await insertProSubscription(ctx, accountId, {
          subscriptionId: `sub_extra_${index}`,
          status: "ended",
        });
      }
    });
    const batch = await t.query(internal.billing.deletion.readSubscriptions, {
      userId,
    });
    expect(batch).toHaveLength(100);
    const remaining = await t.mutation(internal.billing.deletion.deleteRows, {
      subscriptionIds: Arr.map(batch, (row) => row.subscriptionId),
      userId,
    });
    expect(remaining).toBe(true);
    const rest = await t.query(internal.billing.deletion.readSubscriptions, {
      userId,
    });
    expect(rest).toHaveLength(1);
    const last = await t.mutation(internal.billing.deletion.deleteRows, {
      subscriptionIds: Arr.map(rest, (row) => row.subscriptionId),
      userId,
    });
    expect(last).toBe(false);
  });

  it("reports an unreadable account as the billing state failure, and deletes nothing", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) =>
      seedDeletingUser(ctx).then((seeded) => seeded.userId)
    );
    vi.mocked(findAccount).mockImplementationOnce(() =>
      Effect.die(new Error("accounts unreadable"))
    );
    await expect(
      t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
        authId: "auth-billing-deletion",
        userId,
      })
    ).rejects.toThrow();
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toHaveLength(1);
  });

  it("deletes a learner's top-up packs with the learner, and keeps the packs of others", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const seeded = await seedDeletingUser(ctx, null);
      const paymentId = await ctx.db.insert("billingPayments", {
        accountId: seeded.accountId,
        amount: 59_000,
        currency: "IDR",
        kind: "credits",
        method: "order",
        paidAt: NOW,
        providerPaymentId: "order_deleted_pack",
        providerUpdatedAt: NOW,
        rail: "polar",
        status: "succeeded",
      });
      await ctx.db.insert("creditLots", {
        expiresAt: NOW + 1000,
        granted: 1000,
        paymentId,
        remaining: 900,
        state: "active",
        userId: seeded.userId,
      });
      const otherUserId = await ctx.db.insert("users", {
        authId: "auth-billing-deletion-other",
        credits: 0,
        creditsResetAt: NOW,
        email: "kept@example.com",
        mascot: MASCOT_CODE,
        name: "Kept",
        plan: "pro",
      });
      const otherPaymentId = await ctx.db.insert("billingPayments", {
        accountId: await insertPolarAccount(ctx, otherUserId, "cust_kept"),
        amount: 59_000,
        currency: "IDR",
        kind: "credits",
        method: "order",
        paidAt: NOW,
        providerPaymentId: "order_kept_pack",
        providerUpdatedAt: NOW,
        rail: "polar",
        status: "succeeded",
      });
      await ctx.db.insert("creditLots", {
        expiresAt: NOW + 1000,
        granted: 1000,
        paymentId: otherPaymentId,
        remaining: 1000,
        state: "active",
        userId: otherUserId,
      });
      return seeded.userId;
    });
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      authId: "auth-billing-deletion",
      userId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("creditLots").collect())
    ).toMatchObject([{ remaining: 1000, state: "active" }]);
  });
});
