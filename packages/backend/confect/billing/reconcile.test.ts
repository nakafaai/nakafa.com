import { beforeEach, describe, expect, it } from "@effect/vitest";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import {
  PolarCustomerError,
  PolarSubscriptionListError,
  polarCustomerErrorCode,
  polarSubscriptionListErrorCode,
} from "@repo/backend/confect/billing/polar/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  getCustomer: vi.fn(),
  listSubscriptions: vi.fn(),
}));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));

beforeEach(() => {
  polarGateway.getCustomer.mockReset();
  polarGateway.listSubscriptions.mockReset();
});

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

/** One subscription as Polar lists it: the snake_case body the SDK returns. */
function listedSubscription(
  id: string,
  customerId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    cancel_at_period_end: false,
    created_at: "2026-10-01T00:00:00.000Z",
    current_period_end: "2026-11-01T00:00:00.000Z",
    current_period_start: "2026-10-01T00:00:00.000Z",
    customer_id: customerId,
    ended_at: null,
    id,
    modified_at: "2026-10-02T00:00:00.000Z",
    product_id: polarProductIdFor("pro.monthly", "sandbox"),
    recurring_interval: "month",
    status: "active",
    ...overrides,
  };
}

/** Seeds one user with an auth ID and a Polar account linked to the given customer. */
async function seedLinked(
  ctx: MutationCtx,
  authId: string,
  customerId: string
) {
  const userId = await ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: NOW,
    email: `${authId}@example.com`,
    mascot: MASCOT_CODE,
    name: "Reconciled",
    plan: "free",
  });
  return insertPolarAccount(ctx, userId, customerId);
}

/** The billing rows the reconciliation writes, as stored. */
function readBilling(t: ReturnType<typeof createBillingTestConvex>) {
  return t.run(async (ctx) => ({
    grants: await ctx.db.query("billingGrants").collect(),
    subscriptions: await ctx.db.query("billingSubscriptions").collect(),
  }));
}

describe("billing/reconcile", () => {
  it("applies each listed subscription through the webhook path, and ignores what it does not sell", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seedLinked(ctx, "auth-reconcile-1", "cust_r1"));
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [
          listedSubscription("sub_r1", "cust_r1"),
          listedSubscription("sub_r_other", "cust_r1", {
            product_id: "another-product",
          }),
        ],
        maxPage: 1,
      })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    const stored = await readBilling(t);
    expect(stored.subscriptions).toMatchObject([
      {
        offer: "pro.monthly",
        provider: { kind: "polar", subscriptionId: "sub_r1" },
        status: "active",
      },
    ]);
    expect(stored.grants).toHaveLength(1);
    expect(polarGateway.listSubscriptions).toHaveBeenCalledTimes(1);
    expect(polarGateway.listSubscriptions).toHaveBeenCalledWith(1, 100);
  });

  it("links a listed customer Nakafa holds no account for, then applies its subscription", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-reconcile-2",
        credits: 0,
        creditsResetAt: NOW,
        email: "auth-reconcile-2@example.com",
        mascot: MASCOT_CODE,
        name: "Reconciled Two",
        plan: "free",
      })
    );
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [listedSubscription("sub_r2", "cust_r2")],
        maxPage: 1,
      })
    );
    polarGateway.getCustomer.mockReturnValue(
      Effect.succeed({
        billingCountry: "ID",
        email: null,
        externalId: "auth-reconcile-2",
        id: "cust_r2",
        name: null,
      })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    expect(polarGateway.getCustomer).toHaveBeenCalledWith("cust_r2");
    const stored = await readBilling(t);
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toMatchObject([
      { country: "ID", currency: "IDR", providerCustomerId: "cust_r2" },
    ]);
    expect(stored.subscriptions).toHaveLength(1);
  });

  it("does not apply a subscription whose customer is still unknown after another customer was linked", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-reconcile-3",
        credits: 0,
        creditsResetAt: NOW,
        email: "auth-reconcile-3@example.com",
        mascot: MASCOT_CODE,
        name: "Reconciled Three",
        plan: "free",
      })
    );
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [listedSubscription("sub_r3", "cust_r3")],
        maxPage: 1,
      })
    );
    polarGateway.getCustomer.mockReturnValue(
      Effect.succeed({
        billingCountry: null,
        email: null,
        externalId: "auth-reconcile-3",
        id: "cust_r3_other",
        name: null,
      })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    expect((await readBilling(t)).subscriptions).toEqual([]);
  });

  it("counts a customer Polar cannot read as unresolved, and applies the rest of the page", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) =>
      seedLinked(ctx, "auth-reconcile-4", "cust_r4_known")
    );
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [
          listedSubscription("sub_r4_unreadable", "cust_r4_unreadable"),
          listedSubscription("sub_r4_known", "cust_r4_known"),
        ],
        maxPage: 1,
      })
    );
    polarGateway.getCustomer.mockReturnValue(
      Effect.fail(
        new PolarCustomerError({
          code: polarCustomerErrorCode,
          message: "Failed to load Polar customer.",
        })
      )
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    const stored = await readBilling(t);
    expect(stored.subscriptions).toMatchObject([
      { provider: { subscriptionId: "sub_r4_known" } },
    ]);
  });

  it("reads at most ten pages per run, and schedules the run that reads the next one", async () => {
    const t = createBillingTestConvex();
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({ items: [], maxPage: 12 })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    expect(polarGateway.listSubscriptions).toHaveBeenCalledTimes(10);
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.some(scheduled, (entry) =>
        encodeJsonText(entry.args).includes('"page":11')
      )
    ).toBe(true);
  });

  it("applies the same listed state once: a second run changes nothing, and an older state is refused", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seedLinked(ctx, "auth-reconcile-5", "cust_r5"));
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [listedSubscription("sub_r5", "cust_r5")],
        maxPage: 1,
      })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    await t.action(internal.billing.reconcile.run, { page: 1 });
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.succeed({
        items: [
          listedSubscription("sub_r5", "cust_r5", {
            modified_at: "2026-10-01T12:00:00.000Z",
            status: "canceled",
            ended_at: "2026-10-01T12:00:00.000Z",
          }),
        ],
        maxPage: 1,
      })
    );
    await t.action(internal.billing.reconcile.run, { page: 1 });
    const stored = await readBilling(t);
    expect(stored.subscriptions).toMatchObject([{ status: "active" }]);
    expect(stored.grants).toHaveLength(1);
  });

  it("fails the run when Polar cannot list the subscriptions", async () => {
    const t = createBillingTestConvex();
    polarGateway.listSubscriptions.mockReturnValue(
      Effect.fail(
        new PolarSubscriptionListError({
          code: polarSubscriptionListErrorCode,
          message: "Failed to list Polar subscriptions.",
        })
      )
    );
    await expect(
      t.action(internal.billing.reconcile.run, { page: 1 })
    ).rejects.toThrow();
  });

  it("reports text that is not a listed subscription as invalid, and changes nothing", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.mutation(
      internal.billing.reconcile.applySubscription,
      { subscription: "not json" }
    );
    expect(outcome).toBe("invalid");
  });
});
