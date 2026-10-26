import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
/** Instants the runtime's real clock is far from, so a grant that runs or has ended stays so. */
const FAR_FUTURE = Date.UTC(2099, 0, 1);
const FAR_PAST = Date.UTC(2000, 0, 1);

/** Inserts one active user for the checkout steps, optionally marked as deleting. */
async function insertUser(ctx: MutationCtx, deleting = false) {
  return await ctx.db.insert("users", {
    authId: `auth-checkout-${deleting ? "deleting" : "active"}`,
    credits: 0,
    creditsResetAt: NOW,
    ...(deleting ? { deletionPreparedAt: NOW } : {}),
    email: "checkout@example.com",
    mascot: MASCOT_CODE,
    name: "Checkout",
    plan: "free",
  });
}

describe("billing/checkout internal steps", () => {
  it("opens a personal Polar account for a user, once, with the unknown country and its currency", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx));
    const first = await t.mutation(internal.billing.checkout.openAccount, {
      userId,
    });
    const second = await t.mutation(internal.billing.checkout.openAccount, {
      userId,
    });
    expect(first).toEqual({
      accountId: expect.any(String),
      authId: "auth-checkout-active",
      email: "checkout@example.com",
      kind: "open",
      name: "Checkout",
      providerCustomerId: null,
    });
    expect(second).toMatchObject({
      accountId: first.kind === "open" ? first.accountId : null,
    });
    const accounts = await t.run((ctx) =>
      ctx.db.query("billingAccounts").collect()
    );
    expect(accounts).toMatchObject([
      {
        country: "ZZ",
        currency: "USD",
        rail: "polar",
        providerCustomerId: null,
      },
    ]);
  });

  it("withholds an account from a user who is deleting or does not exist", async () => {
    const t = createBillingTestConvex();
    const deletingUserId = await t.mutation((ctx) => insertUser(ctx, true));
    expect(
      await t.mutation(internal.billing.checkout.openAccount, {
        userId: deletingUserId,
      })
    ).toEqual({ kind: "unavailable" });
    const missing = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "auth-checkout-missing",
        credits: 0,
        creditsResetAt: NOW,
        email: "missing@example.com",
        mascot: MASCOT_CODE,
        name: "Missing",
        plan: "free",
      })
    );
    await t.mutation((ctx) => ctx.db.delete("users", missing));
    expect(
      await t.mutation(internal.billing.checkout.openAccount, {
        userId: missing,
      })
    ).toEqual({ kind: "unavailable" });
  });

  it("lets no customer be adopted for a user who is deleting or does not exist", async () => {
    const t = createBillingTestConvex();
    const deletingUserId = await t.mutation((ctx) => insertUser(ctx, true));
    const missing = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await ctx.db.delete("users", userId);
      return userId;
    });
    for (const userId of [deletingUserId, missing]) {
      expect(
        await t.query(internal.billing.checkout.mayAdoptCustomer, {
          externalId: null,
          userId,
        })
      ).toBe(false);
    }
  });

  it("records the Polar customer on the account it was linked to", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      await insertPolarAccount(ctx, id, null);
      return id;
    });
    const opened = await t.mutation(internal.billing.checkout.openAccount, {
      userId,
    });
    expect(opened.kind).toBe("open");
    if (opened.kind !== "open") {
      throw new Error("Expected an open account.");
    }
    await t.mutation(internal.billing.checkout.recordCustomer, {
      accountId: opened.accountId,
      providerCustomerId: "cust_recorded",
    });
    const reopened = await t.mutation(internal.billing.checkout.openAccount, {
      userId,
    });
    expect(reopened).toMatchObject({ providerCustomerId: "cust_recorded" });
  });

  it("admits a checkout for an active user and withholds it from one who is deleting", async () => {
    const t = createBillingTestConvex();
    const active = await t.mutation((ctx) => insertUser(ctx));
    const deleting = await t.mutation((ctx) => insertUser(ctx, true));
    const event = {
      name: "checkout started" as const,
      properties: {
        checkout_locale: "en" as const,
        customer_ip_available: false,
        locale: "en" as const,
        product_count: 1,
        rail: "polar" as const,
        product_id: "product_1",
      },
    };
    expect(
      await t.mutation(internal.billing.checkout.admitCheckout, {
        event,
        requiresPro: false,
        userId: active,
      })
    ).toEqual({ kind: "admitted" });
    expect(
      await t.mutation(internal.billing.checkout.admitCheckout, {
        event,
        requiresPro: false,
        userId: deleting,
      })
    ).toEqual({ kind: "unavailable" });
  });

  it("refuses an admission for a user who no longer exists", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      await ctx.db.delete(id);
      return id;
    });
    expect(
      await t.mutation(internal.billing.checkout.admitCheckout, {
        event: {
          name: "checkout started" as const,
          properties: {
            checkout_locale: "en" as const,
            customer_ip_available: false,
            locale: "en" as const,
            product_count: 1,
            rail: "polar" as const,
            product_id: "product_1",
          },
        },
        requiresPro: false,
        userId,
      })
    ).toEqual({ kind: "unavailable" });
  });

  it("holds Pro for a user with no grant and no subscription on any rail as free", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx));
    expect(await t.query(internal.billing.checkout.holdsPro, { userId })).toBe(
      false
    );
  });

  it("holds Pro for a user whose personal Pro grant still runs", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      await ctx.db.insert("billingGrants", {
        product: "pro",
        source: { kind: "contract", contractId: "contract-holds" },
        userId: id,
        validFrom: NOW - 1000,
        validTo: FAR_FUTURE,
      });
      return id;
    });
    expect(await t.query(internal.billing.checkout.holdsPro, { userId })).toBe(
      true
    );
  });

  it("does not hold Pro for a personal Pro grant that has ended", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      await ctx.db.insert("billingGrants", {
        product: "pro",
        source: { kind: "contract", contractId: "contract-ended" },
        userId: id,
        validFrom: FAR_PAST - 2000,
        validTo: FAR_PAST,
      });
      return id;
    });
    expect(await t.query(internal.billing.checkout.holdsPro, { userId })).toBe(
      false
    );
  });

  it.each(["active", "pastDue"] as const)(
    "holds Pro for a user whose Pro subscription is %s on the Polar account",
    async (status) => {
      const t = createBillingTestConvex();
      const userId = await t.mutation(async (ctx) => {
        const id = await insertUser(ctx);
        const accountId = await insertPolarAccount(ctx, id, "cust_holds");
        await insertProSubscription(ctx, accountId, { status });
        return id;
      });
      expect(
        await t.query(internal.billing.checkout.holdsPro, { userId })
      ).toBe(true);
    }
  );

  it("holds Pro for a user whose Pro subscription is active on the Xendit account", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId: id },
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
        currentPeriodStart: NOW - 1000,
        currentPeriodEnd: NOW + 1000,
        cancelAtPeriodEnd: false,
        provider: {
          kind: "xendit",
          planId: "plan_holds",
          tokenId: null,
          channel: "CARDS",
        },
        providerUpdatedAt: NOW,
      });
      return id;
    });
    expect(await t.query(internal.billing.checkout.holdsPro, { userId })).toBe(
      true
    );
  });

  it("does not hold Pro for a canceled Pro subscription, or for a school offer on a person's account", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      const accountId = await insertPolarAccount(ctx, id, "cust_canceled");
      await insertProSubscription(ctx, accountId, {
        status: "canceled",
        subscriptionId: "sub_canceled",
      });
      await ctx.db.insert("billingSubscriptions", {
        accountId,
        offer: "school.seat.month",
        quantity: 1,
        status: "active",
        currentPeriodStart: NOW - 1000,
        currentPeriodEnd: NOW + 1000,
        cancelAtPeriodEnd: false,
        provider: {
          kind: "polar",
          subscriptionId: "sub_school_on_person",
          productId: "prod_school_on_person",
          priceId: null,
        },
        providerUpdatedAt: NOW,
      });
      return id;
    });
    expect(await t.query(internal.billing.checkout.holdsPro, { userId })).toBe(
      false
    );
  });
});
