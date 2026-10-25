import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

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
        product_id: "product_1",
      },
    };
    expect(
      await t.mutation(internal.billing.checkout.admitCheckout, {
        event,
        userId: active,
      })
    ).toEqual({ kind: "admitted" });
    expect(
      await t.mutation(internal.billing.checkout.admitCheckout, {
        event,
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
            product_id: "product_1",
          },
        },
        userId,
      })
    ).toEqual({ kind: "unavailable" });
  });
});
