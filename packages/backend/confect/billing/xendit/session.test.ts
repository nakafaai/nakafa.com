import { describe, expect, it } from "@effect/vitest";
import type { BillingOfferKey } from "@repo/backend/confect/billing/catalog";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import { renewalAnchor } from "@repo/backend/confect/billing/xendit/renewal";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
  seedXenditSubscription,
  xenditDelivery,
} from "@repo/backend/test/billing";
import { Array as Arr, DateTime, Exit } from "effect";

/** Opens one Xendit checkout for a fresh Xendit payer, as checkout does before the buyer pays. */
async function seedCheckout(
  ctx: MutationCtx,
  offer: BillingOfferKey,
  rail: "polar" | "xendit" = "xendit"
) {
  const { accountId, subscriptionId, userId } = await seedXenditSubscription(
    ctx,
    { rail }
  );
  const checkoutId = await ctx.db.insert("billingCheckouts", {
    accountId,
    offer,
    rail: "xendit",
    sessionId: "ps_1",
    url: "https://checkout-staging.xendit.co/sessions/ps_1",
    status: "open",
    openedAt: 0,
    expiresAt: 1_800_000,
    locale: "id",
  });
  return { accountId, checkoutId, subscriptionId, userId };
}

/** One `payment_session.*` delivery for pay session `ps_1`, with the channel it saved when it saved one. */
function sessionDelivery(
  event: string,
  paymentId: string | null,
  tokenId?: string
) {
  return xenditDelivery(event, {
    payment_id: paymentId,
    payment_session_id: "ps_1",
    ...(tokenId === undefined ? {} : { payment_token_id: tokenId }),
    reference_id: "checkout-1",
    session_type: "PAY",
    status: event === "payment_session.completed" ? "COMPLETED" : "EXPIRED",
  });
}

describe("billing/xendit/session", () => {
  it("records a paid pass once and gives its owner Pro for the pass months", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId, userId } = await seedCheckout(ctx, "pro.pass.3");
      const delivery = sessionDelivery("payment_session.completed", "py_1");
      const outcome = await runInMutation(ctx, processXenditEvent(delivery));
      const redelivered = await runInMutation(
        ctx,
        processXenditEvent(delivery)
      );
      const payments = await ctx.db.query("billingPayments").collect();
      const grants = await ctx.db.query("billingGrants").collect();
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        grants,
        outcome,
        payments,
        redelivered,
        userId,
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.redelivered).toBe("unknownSession");
    expect(result.checkout).toBe("completed");
    expect(result.payments).toMatchObject([
      {
        amount: 229_000,
        currency: "IDR",
        kind: "pass",
        providerPaymentId: "py_1",
        rail: "xendit",
        status: "succeeded",
      },
    ]);
    expect(result.grants).toHaveLength(1);
    const [grant] = result.grants;
    expect(grant).toMatchObject({
      product: "pro",
      source: { kind: "pass", paymentId: result.payments[0]?._id },
      userId: result.userId,
    });
    expect(grant?.validTo).toBe(
      DateTime.toEpochMillis(
        DateTime.add(DateTime.makeUnsafe(grant?.validFrom ?? 0), {
          months: 3,
        })
      )
    );
  });

  it("starts a pass bought while Pro still runs where that Pro ends", async () => {
    const t = createBillingTestConvex();
    const runningEnd = Date.UTC(2099, 0, 31);
    const grants = await t.run(async (ctx) => {
      const { userId } = await seedCheckout(ctx, "pro.pass.1");
      await ctx.db.insert("billingGrants", {
        product: "pro",
        userId,
        source: { kind: "contract", contractId: "contract-running" },
        validFrom: 0,
        validTo: runningEnd,
      });
      await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "py_extend")
        )
      );
      return {
        grants: await ctx.db
          .query("billingGrants")
          .withIndex("by_userId_and_validTo", (query) =>
            query.eq("userId", userId)
          )
          .collect(),
        jobs: Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name.startsWith("billing/reminder/")
        ),
      };
    });
    // The reminder goes out three days before the new pass ends, in the language of its checkout.
    expect(grants.jobs).toMatchObject([
      {
        args: [{ locale: "id" }],
        name: "billing/reminder/delivery:deliver",
        scheduledTime: Date.UTC(2099, 1, 25),
      },
    ]);
    expect(grants.grants).toMatchObject([
      { validTo: runningEnd },
      {
        source: { kind: "pass" },
        validFrom: runningEnd,
        validTo: Date.UTC(2099, 1, 28),
      },
    ]);
  });

  it("records a paid top-up with the session as its payment, and grants no Pro for it", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedCheckout(ctx, "pro.topup");
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", null))
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.payments).toMatchObject([
      { amount: 59_000, providerPaymentId: "ps_1" },
    ]);
    expect(result.grants).toEqual([]);
  });

  it("starts the monthly plan when its first month is paid: the subscription runs until its first renewal, the payment is its first cycle, Pro is granted, and its plan opens on the saved channel", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId, subscriptionId } = await seedCheckout(
        ctx,
        "pro.monthly"
      );
      await ctx.db.delete(subscriptionId);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "py_first", "pt_1")
        )
      );
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        grants: await ctx.db.query("billingGrants").collect(),
        jobs: Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name.startsWith("billing/xendit/renewal")
        ),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        subscriptions: await ctx.db.query("billingSubscriptions").collect(),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.checkout).toBe("completed");
    const [subscription] = result.subscriptions;
    expect(result.subscriptions).toMatchObject([
      {
        cancelAtPeriodEnd: false,
        offer: "pro.monthly",
        provider: { kind: "xendit", planId: null, tokenId: "pt_1" },
        status: "active",
      },
    ]);
    expect(subscription?.currentPeriodEnd).toBe(
      DateTime.toEpochMillis(
        renewalAnchor(subscription?.currentPeriodStart ?? 0, 1)
      )
    );
    expect(result.payments).toMatchObject([
      {
        amount: 79_000,
        kind: "cycle",
        providerPaymentId: "py_first",
        subscriptionId: subscription?._id,
      },
    ]);
    expect(result.grants).toMatchObject([
      {
        product: "pro",
        source: { kind: "subscription", subscriptionId: subscription?._id },
      },
    ]);
    expect(result.jobs).toMatchObject([
      {
        args: [{ locale: "id", subscriptionId: subscription?._id }],
        name: "billing/xendit/renewal:open",
      },
    ]);
  });

  it("starts the paid month without a plan when the session saved no channel", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedCheckout(ctx, "pro.monthly");
      await ctx.db.delete(subscriptionId);
      await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "py_first")
        )
      );
      return {
        jobs: Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name.startsWith("billing/xendit/renewal")
        ),
        subscriptions: await ctx.db.query("billingSubscriptions").collect(),
      };
    });
    expect(result.subscriptions).toMatchObject([
      { provider: { planId: null, tokenId: null }, status: "active" },
    ]);
    expect(result.jobs).toEqual([]);
  });

  it("closes a session that closed unpaid, and writes nothing else", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId, subscriptionId } = await seedCheckout(
        ctx,
        "pro.monthly"
      );
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.expired", null))
      );
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        subscription: (await ctx.db.get(subscriptionId))?.status,
      };
    });
    expect(result).toEqual({
      checkout: "expired",
      outcome: "applied",
      payments: [],
      subscription: "pending",
    });
  });

  it("reports a session it opened no checkout for, and a session that does not decode", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => ({
      completed: await runInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", "py_1"))
      ),
      expired: await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", { status: "EXPIRED" })
        )
      ),
      expiredUnknown: await runInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.expired", null))
      ),
      invalid: await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.completed", { status: "COMPLETED" })
        )
      ),
    }));
    expect(result).toEqual({
      completed: "unknownSession",
      expired: "invalid",
      expiredUnknown: "unknownSession",
      invalid: "invalid",
    });
  });

  it("changes nothing for a checkout whose account is not a Xendit account", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedCheckout(ctx, "pro.pass.1", "polar");
      return runInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", "py_1"))
      );
    });
    expect(outcome).toBe("railMismatch");
  });

  it("fails without writing when the checkout's account is gone or its offer has no price there", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const gone = await seedCheckout(ctx, "pro.pass.1");
      await ctx.db.delete(gone.accountId);
      const missing = await exitInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", "py_1"))
      );
      const unpriced = await seedCheckout(ctx, "school.seat.month");
      await ctx.db.delete(gone.checkoutId);
      await ctx.db.patch(unpriced.checkoutId, { sessionId: "ps_1" });
      const priceless = await exitInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", "py_1"))
      );
      const dollars = await seedCheckout(ctx, "pro.pass.1");
      await ctx.db.delete(unpriced.checkoutId);
      await ctx.db.patch(dollars.accountId, { currency: "USD" });
      const unpricedPass = await exitInMutation(
        ctx,
        processXenditEvent(sessionDelivery("payment_session.completed", "py_1"))
      );
      return {
        missing: Exit.isFailure(missing),
        payments: await ctx.db.query("billingPayments").collect(),
        priceless: Exit.isFailure(priceless),
        unpricedPass: Exit.isFailure(unpricedPass),
      };
    });
    expect(result).toEqual({
      missing: true,
      payments: [],
      priceless: true,
      unpricedPass: true,
    });
  });
});
