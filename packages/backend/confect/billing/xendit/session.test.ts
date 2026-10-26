import { describe, expect, it } from "@effect/vitest";
import type { BillingOfferKey } from "@repo/backend/confect/billing/catalog";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  insertSchool,
  runInMutation,
  seedXenditSubscription,
  xenditDelivery,
} from "@repo/backend/test/billing";
import { DateTime, Exit } from "effect";

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
    invoiceId: null,
  });
  return { accountId, checkoutId, subscriptionId, userId };
}

/** One `payment_session.*` delivery for session `ps_1`. */
function sessionDelivery(
  event: string,
  sessionType: "PAY" | "SUBSCRIPTION",
  paymentId: string | null
) {
  return xenditDelivery(event, {
    payment_id: paymentId,
    payment_session_id: "ps_1",
    recurring_plan_id: sessionType === "SUBSCRIPTION" ? "repl_1" : null,
    reference_id: "checkout-1",
    session_type: sessionType,
    status: event === "payment_session.completed" ? "COMPLETED" : "EXPIRED",
  });
}

describe("billing/xendit/session", () => {
  it("records a paid pass once and gives its owner Pro for the pass months", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId, userId } = await seedCheckout(ctx, "pro.pass.3");
      const delivery = sessionDelivery(
        "payment_session.completed",
        "PAY",
        "py_1"
      );
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

  it("records a paid top-up with the session as its payment, and grants no Pro for it", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedCheckout(ctx, "pro.topup");
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", null)
        )
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

  it("closes a completed subscription session without a payment, since the plan's events charge it", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId } = await seedCheckout(ctx, "pro.monthly");
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "SUBSCRIPTION", null)
        )
      );
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result).toEqual({
      checkout: "completed",
      outcome: "applied",
      payments: [],
    });
  });

  it("cancels the pending subscription of a session that closed unpaid", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { checkoutId, subscriptionId } = await seedCheckout(
        ctx,
        "pro.monthly"
      );
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.expired", "SUBSCRIPTION", null)
        )
      );
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        outcome,
        subscription: (await ctx.db.get(subscriptionId))?.status,
      };
    });
    expect(result).toEqual({
      checkout: "expired",
      outcome: "applied",
      subscription: "canceled",
    });
  });

  it("closes an expired pay session, and leaves a subscription that is no longer pending as it is", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, checkoutId, subscriptionId } = await seedCheckout(
        ctx,
        "pro.pass.1"
      );
      await ctx.db.patch(subscriptionId, { status: "active" });
      await ctx.db.insert("billingCheckouts", {
        accountId,
        offer: "pro.monthly",
        rail: "xendit",
        sessionId: "ps_9",
        url: "https://checkout-staging.xendit.co/sessions/ps_9",
        status: "open",
        openedAt: 0,
        expiresAt: 1_800_000,
        invoiceId: null,
      });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.expired", "PAY", null)
        )
      );
      const planned = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", {
            payment_session_id: "ps_9",
            recurring_plan_id: "repl_1",
            reference_id: "checkout-9",
            session_type: "SUBSCRIPTION",
            status: "EXPIRED",
          })
        )
      );
      return {
        checkout: (await ctx.db.get(checkoutId))?.status,
        outcome,
        planned,
        subscription: (await ctx.db.get(subscriptionId))?.status,
      };
    });
    expect(result).toEqual({
      checkout: "expired",
      outcome: "applied",
      planned: "applied",
      subscription: "active",
    });
  });

  it("reports a session it opened no checkout for, and a session that does not decode", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => ({
      completed: await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", "py_1")
        )
      ),
      expired: await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", { status: "EXPIRED" })
        )
      ),
      expiredUnknown: await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.expired", "PAY", null)
        )
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
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", "py_1")
        )
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
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", "py_1")
        )
      );
      const unpriced = await seedCheckout(ctx, "school.seat.month");
      await ctx.db.delete(gone.checkoutId);
      await ctx.db.patch(unpriced.checkoutId, { sessionId: "ps_1" });
      const priceless = await exitInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", "py_1")
        )
      );
      return {
        missing: Exit.isFailure(missing),
        payments: await ctx.db.query("billingPayments").collect(),
        priceless: Exit.isFailure(priceless),
      };
    });
    expect(result).toEqual({ missing: true, payments: [], priceless: true });
  });

  it("pays the school invoice a completed session was opened for, and takes the link off an open invoice whose session expired", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const invoice = (number: string) =>
        ctx.db.insert("billingInvoices", {
          accountId,
          number,
          status: "open",
          currency: "IDR",
          lines: [
            {
              description: "school.seat.year",
              quantity: 3,
              unitAmount: 100_000,
              amount: 300_000,
            },
          ],
          total: 300_000,
          periodStart: 0,
          periodEnd: 1_800_000,
          dueAt: 1_800_000,
          paymentLink: `https://dev.xen.to/${number}`,
          buyerTaxId: null,
        });
      const paidId = await invoice("NKF-2026-000001");
      const expiredId = await invoice("NKF-2026-000002");
      const checkout = (sessionId: string, invoiceId: typeof paidId) =>
        ctx.db.insert("billingCheckouts", {
          accountId,
          offer: "school.seat.year",
          rail: "xendit",
          sessionId,
          url: `https://dev.xen.to/${sessionId}`,
          status: "open",
          openedAt: 0,
          expiresAt: 1_800_000,
          invoiceId,
        });
      await checkout("ps_1", paidId);
      await checkout("ps_2", expiredId);
      const paid = await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.completed", "PAY", "py_invoice")
        )
      );
      const expired = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", {
            payment_id: null,
            payment_session_id: "ps_2",
            recurring_plan_id: null,
            reference_id: "NKF-2026-000002",
            session_type: "PAY",
            status: "EXPIRED",
          })
        )
      );
      return {
        expired,
        expiredInvoice: await ctx.db.get(expiredId),
        grants: await ctx.db.query("billingGrants").collect(),
        paid,
        paidInvoice: await ctx.db.get(paidId),
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.paid).toBe("applied");
    expect(result.expired).toBe("applied");
    expect(result.paidInvoice).toMatchObject({
      paymentLink: "https://dev.xen.to/NKF-2026-000001",
      status: "paid",
    });
    expect(result.expiredInvoice).toMatchObject({
      paymentLink: null,
      status: "open",
    });
    expect(result.payments).toMatchObject([
      {
        amount: 300_000,
        kind: "invoice",
        method: "session",
        providerPaymentId: "py_invoice",
      },
    ]);
    expect(result.grants).toMatchObject([
      { product: "school", seats: 3, source: { kind: "invoice" } },
    ]);
  });

  it("keeps the link of an invoice paid before its other session expired", async () => {
    const t = createBillingTestConvex();
    const invoice = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const invoiceId = await ctx.db.insert("billingInvoices", {
        accountId,
        number: "NKF-2026-000003",
        status: "paid",
        currency: "IDR",
        lines: [
          {
            description: "school.seat.year",
            quantity: 1,
            unitAmount: 100_000,
            amount: 100_000,
          },
        ],
        total: 100_000,
        periodStart: 0,
        periodEnd: 1_800_000,
        dueAt: 1_800_000,
        paymentLink: "https://dev.xen.to/paid",
        buyerTaxId: null,
      });
      await ctx.db.insert("billingCheckouts", {
        accountId,
        offer: "school.seat.year",
        rail: "xendit",
        sessionId: "ps_1",
        url: "https://dev.xen.to/ps_1",
        status: "open",
        openedAt: 0,
        expiresAt: 1_800_000,
        invoiceId,
      });
      await runInMutation(
        ctx,
        processXenditEvent(
          sessionDelivery("payment_session.expired", "PAY", null)
        )
      );
      return await ctx.db.get(invoiceId);
    });
    expect(invoice?.paymentLink).toBe("https://dev.xen.to/paid");
  });
});
