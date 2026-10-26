import { describe, expect, it } from "@effect/vitest";
import { accountUnavailableCode } from "@repo/backend/confect/auth/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createBillingTestConvex } from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);
/** Instants the runtime's real clock is far from, so a session that closes then stays open or has closed. */
const FAR_FUTURE = Date.UTC(2099, 0, 1);
const FAR_PAST = Date.UTC(2000, 0, 1);

const steps = internal.billing.xendit.checkout;

/** The analytics event a Xendit checkout sends once it is admitted. */
const event = {
  name: "checkout started" as const,
  properties: {
    checkout_locale: "id" as const,
    customer_ip_available: false,
    locale: "id" as const,
    product_count: 1,
    product_id: "pro.monthly",
    rail: "xendit" as const,
  },
};

/** Inserts one learner, optionally marked as deleting. */
function insertUser(ctx: MutationCtx, deleting = false) {
  return ctx.db.insert("users", {
    authId: `auth-xendit-checkout-${deleting ? "deleting" : "active"}`,
    credits: 0,
    creditsResetAt: NOW,
    ...(deleting ? { deletionPreparedAt: NOW } : {}),
    email: "xendit-checkout@example.com",
    mascot: MASCOT_CODE,
    name: "Xendit Checkout",
    plan: "free",
  });
}

/** Inserts one open checkout of the account, closing at `expiresAt`. */
function insertOpenCheckout(
  ctx: MutationCtx,
  accountId: Id<"billingAccounts">,
  offer: "pro.monthly" | "pro.pass.1",
  expiresAt: number
) {
  return ctx.db.insert("billingCheckouts", {
    accountId,
    offer,
    rail: "xendit",
    sessionId: `ps-${offer}-${expiresAt}`,
    url: `https://dev.xen.to/${offer}-${expiresAt}`,
    status: "open",
    openedAt: FAR_PAST,
    expiresAt,
    invoiceId: null,
  });
}

describe("billing/xendit/checkout internal steps", () => {
  it("opens one Xendit account in rupiah and reopens only an open session of the same offer with time left", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx));
    const first = await t.mutation(steps.prepare, {
      offer: "pro.monthly",
      userId,
    });
    expect(first).toEqual({
      accountId: expect.any(String),
      authId: "auth-xendit-checkout-active",
      email: "xendit-checkout@example.com",
      name: "Xendit Checkout",
      openUrl: null,
      providerCustomerId: null,
    });
    await t.mutation(async (ctx) => {
      await insertOpenCheckout(ctx, first.accountId, "pro.pass.1", FAR_FUTURE);
      await insertOpenCheckout(ctx, first.accountId, "pro.monthly", FAR_PAST);
    });
    const closing = await t.mutation(steps.prepare, {
      offer: "pro.monthly",
      userId,
    });
    expect(closing).toMatchObject({
      accountId: first.accountId,
      openUrl: null,
    });
    await t.mutation((ctx) =>
      insertOpenCheckout(ctx, first.accountId, "pro.monthly", FAR_FUTURE)
    );
    const reopened = await t.mutation(steps.prepare, {
      offer: "pro.monthly",
      userId,
    });
    expect(reopened).toMatchObject({
      openUrl: `https://dev.xen.to/pro.monthly-${FAR_FUTURE}`,
    });
    const accounts = await t.run((ctx) =>
      ctx.db.query("billingAccounts").collect()
    );
    expect(accounts).toMatchObject([
      { country: "ID", currency: "IDR", rail: "xendit" },
    ]);
  });

  it("opens no account for a learner who is deleting or no longer exists", async () => {
    const t = createBillingTestConvex();
    const deleting = await t.mutation((ctx) => insertUser(ctx, true));
    const missing = await t.mutation(async (ctx) => {
      const id = await insertUser(ctx);
      await ctx.db.delete(id);
      return id;
    });
    for (const userId of [deleting, missing]) {
      await expect(
        t.mutation(steps.prepare, { offer: "pro.pass.1", userId })
      ).rejects.toThrow(accountUnavailableCode);
    }
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toStrictEqual([]);
  });

  it("records a subscription session with its pending plan, and a pay session alone", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx));
    const prepared = await t.mutation(steps.prepare, {
      offer: "pro.monthly",
      userId,
    });
    const subscription = await t.mutation(steps.admit, {
      accountId: prepared.accountId,
      event,
      offer: "pro.monthly",
      session: {
        expiresAt: FAR_FUTURE,
        planId: "repl-1",
        sessionId: "ps-1",
        url: "https://dev.xen.to/ps-1",
      },
      userId,
    });
    const pass = await t.mutation(steps.admit, {
      accountId: prepared.accountId,
      event,
      offer: "pro.pass.3",
      session: {
        expiresAt: FAR_FUTURE,
        planId: null,
        sessionId: "ps-2",
        url: "https://dev.xen.to/ps-2",
      },
      userId,
    });
    expect(subscription).toBeNull();
    expect(pass).toBeNull();
    const rows = await t.run(async (ctx) => ({
      checkouts: await ctx.db.query("billingCheckouts").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(rows.checkouts).toMatchObject([
      { offer: "pro.monthly", sessionId: "ps-1", status: "open" },
      { offer: "pro.pass.3", sessionId: "ps-2", status: "open" },
    ]);
    expect(rows.subscriptions).toMatchObject([
      {
        accountId: prepared.accountId,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        offer: "pro.monthly",
        provider: { channel: null, kind: "xendit", planId: "repl-1" },
        quantity: 1,
        status: "pending",
      },
    ]);
  });

  it("records nothing for a learner whose deletion started during Xendit IO", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx));
    const prepared = await t.mutation(steps.prepare, {
      offer: "pro.monthly",
      userId,
    });
    await t.mutation((ctx) =>
      ctx.db.patch(userId, { deletionPreparedAt: NOW })
    );
    await expect(
      t.mutation(steps.admit, {
        accountId: prepared.accountId,
        event,
        offer: "pro.monthly",
        session: {
          expiresAt: FAR_FUTURE,
          planId: "repl-1",
          sessionId: "ps-1",
          url: "https://dev.xen.to/ps-1",
        },
        userId,
      })
    ).rejects.toThrow(accountUnavailableCode);
    const rows = await t.run(async (ctx) => ({
      checkouts: await ctx.db.query("billingCheckouts").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(rows).toStrictEqual({ checkouts: [], subscriptions: [] });
  });
});
