import { beforeEach, describe, expect, it } from "@effect/vitest";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  deleteCustomer: vi.fn(),
}));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));
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

  it("deletes the Polar customer, then every billing row of the user", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx)).userId
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
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

  it("deletes no Polar customer for an account that never linked one", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(
      async (ctx) => (await seedDeletingUser(ctx, null)).userId
    );
    await t.action(internal.billing.deletion.cleanupDeletedUserBilling, {
      userId,
    });
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toEqual([]);
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
    const remaining = await t.mutation(internal.billing.deletion.deleteRows, {
      userId,
    });
    expect(remaining).toBe(true);
    const last = await t.mutation(internal.billing.deletion.deleteRows, {
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
      t.action(internal.billing.deletion.cleanupDeletedUserBilling, { userId })
    ).rejects.toThrow();
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toHaveLength(1);
  });
});
