import { describe, expect, it } from "@effect/vitest";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertSchool,
  runInMutation,
  seedXenditCheckout,
  seedXenditSubscription,
  xenditDelivery,
  xenditSessionDelivery,
} from "@repo/backend/test/billing";
import { Array as Arr, DateTime } from "effect";

const PASS_PRICE = 79_000;
const PACK_PRICE = 59_000;
const FAR_FUTURE = Date.UTC(2100, 0, 1);
const REFUNDED_AT = Date.UTC(2026, 10, 1, 8, 17, 16);

/** One `refund.succeeded` delivery, as Xendit names a refund of `paymentId` at `at`. */
const refundOf = (paymentId: string, amount: number, at = REFUNDED_AT) =>
  xenditDelivery("refund.succeeded", {
    amount,
    channel_code: "CARDS",
    currency: "IDR",
    payment_id: paymentId,
    reason: "REQUESTED_BY_CUSTOMER",
    refund_id: "rfd-1",
    status: "SUCCEEDED",
    updated: DateTime.formatIso(DateTime.makeUnsafe(at)),
  });

/** A learner on the monthly plan, with the plan's paid period and its grant. */
async function seedRunningPlan(
  ctx: MutationCtx,
  provider: Parameters<typeof ctx.db.patch<"billingSubscriptions">>[1] = {}
) {
  const { accountId, subscriptionId, userId } =
    await seedXenditSubscription(ctx);
  await ctx.db.patch("billingSubscriptions", subscriptionId, {
    currentPeriodEnd: FAR_FUTURE,
    currentPeriodStart: Date.UTC(2026, 9, 1),
    status: "active",
    ...provider,
  });
  await ctx.db.insert("billingGrants", {
    product: "pro",
    source: { kind: "subscription", subscriptionId },
    userId,
    validFrom: Date.UTC(2026, 9, 1),
    validTo: FAR_FUTURE,
  });
  return { accountId, subscriptionId };
}

/** A cycle of `subscriptionId` paid at `paidAt`. */
const insertCycle = (
  ctx: MutationCtx,
  accountId: Id<"billingAccounts">,
  subscriptionId: Id<"billingSubscriptions">,
  paidAt: number
) =>
  ctx.db.insert("billingPayments", {
    accountId,
    amount: PASS_PRICE,
    currency: "IDR",
    kind: "cycle",
    method: "recurring",
    paidAt,
    providerPaymentId: "py_cycle",
    providerUpdatedAt: paidAt,
    rail: "xendit",
    status: "succeeded",
    subscriptionId,
  });

/** The background jobs waiting to run, by their names. */
const scheduledNames = async (ctx: MutationCtx) =>
  Arr.map(
    await ctx.db.system.query("_scheduled_functions").collect(),
    (job) => job.name
  );

describe("billing/xendit/refund", () => {
  it("takes a refunded pass back at once, and a redelivery changes nothing", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedXenditCheckout(ctx, "pro.pass.1");
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditSessionDelivery("payment_session.completed", "py_1")
        )
      );
      const [paid] = await ctx.db.query("billingGrants").collect();
      const at = (paid?.validFrom ?? 0) + 1000;
      const delivery = refundOf("py_1", PASS_PRICE, at);
      const outcome = await runInMutation(ctx, processXenditEvent(delivery));
      const redelivered = await runInMutation(
        ctx,
        processXenditEvent(delivery)
      );
      return {
        at,
        grants: await ctx.db.query("billingGrants").collect(),
        jobs: await scheduledNames(ctx),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        redelivered,
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.redelivered).toBe("duplicate");
    expect(result.payments).toMatchObject([
      { providerUpdatedAt: result.at, status: "refunded" },
    ]);
    expect(result.grants).toMatchObject([{ validTo: result.at }]);
    expect(result.jobs).toContainEqual(expect.stringContaining("project"));
  });

  it("never starts a refunded pass still waiting its turn, and keeps the pass that runs", async () => {
    const t = createBillingTestConvex();
    const start = Date.UTC(2026, 11, 1);
    const result = await t.run(async (ctx) => {
      const { accountId, userId } = await seedXenditSubscription(ctx);
      const paymentId = await ctx.db.insert("billingPayments", {
        accountId,
        amount: PASS_PRICE,
        currency: "IDR",
        kind: "pass",
        method: "session",
        paidAt: REFUNDED_AT - 1000,
        providerPaymentId: "py_waiting",
        providerUpdatedAt: REFUNDED_AT - 1000,
        rail: "xendit",
        status: "succeeded",
      });
      const running = await ctx.db.insert("billingGrants", {
        product: "pro",
        source: { kind: "contract", contractId: "contract-running" },
        userId,
        validFrom: 0,
        validTo: start,
      });
      const waiting = await ctx.db.insert("billingGrants", {
        product: "pro",
        source: { kind: "pass", paymentId },
        userId,
        validFrom: start,
        validTo: FAR_FUTURE,
      });
      await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_waiting", PASS_PRICE))
      );
      return {
        running: await ctx.db.get(running),
        waiting: await ctx.db.get(waiting),
      };
    });
    expect(result.running?.validTo).toBe(start);
    expect(result.waiting?.validTo).toBe(start);
  });

  it.each([
    ["whose grant already ended", "personal"],
    ["on a school's account, which a pass grants nothing", "school"],
  ] as const)("records the refund of a pass %s", async (_, owner) => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId } = await seedXenditSubscription(ctx);
      if (owner === "school") {
        await ctx.db.patch("billingAccounts", accountId, {
          owner: { kind: "tenant", tenantId: await insertSchool(ctx) },
        });
      }
      await ctx.db.insert("billingPayments", {
        accountId,
        amount: PASS_PRICE,
        currency: "IDR",
        kind: "pass",
        method: "session",
        paidAt: 1,
        providerPaymentId: "py_ended",
        providerUpdatedAt: 1,
        rail: "xendit",
        status: "succeeded",
      });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_ended", PASS_PRICE))
      );
      return {
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.payments).toMatchObject([{ status: "refunded" }]);
  });

  it("removes the unused credits of a refunded pack, and gives no Pro or time back", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { userId } = await seedXenditCheckout(ctx, "pro.topup");
      await ctx.db.insert("billingGrants", {
        product: "pro",
        source: { kind: "contract", contractId: "contract-topup" },
        userId,
        validFrom: 0,
        validTo: FAR_FUTURE,
      });
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditSessionDelivery("payment_session.completed", "py_pack")
        )
      );
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_pack", PACK_PRICE))
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        lots: await ctx.db.query("creditLots").collect(),
        outcome,
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.lots).toMatchObject([{ state: "refunded" }]);
    expect(result.grants).toMatchObject([{ validTo: FAR_FUTURE }]);
  });

  it("stops the plan whose running period the refunded payment paid", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, subscriptionId } = await seedRunningPlan(ctx);
      await insertCycle(
        ctx,
        accountId,
        subscriptionId,
        Date.UTC(2026, 9, 1, 1)
      );
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_cycle", PASS_PRICE))
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        jobs: await scheduledNames(ctx),
        outcome,
        subscription: await ctx.db.get(subscriptionId),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.subscription).toMatchObject({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: REFUNDED_AT,
      status: "canceled",
    });
    expect(result.grants).toMatchObject([{ validTo: REFUNDED_AT }]);
    expect(result.jobs).toContainEqual(expect.stringContaining("deactivate"));
  });

  it("stops a first month whose plan never opened, with nothing to turn off", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, subscriptionId } = await seedRunningPlan(ctx, {
        provider: { kind: "xendit", planId: null, tokenId: "pt_1" },
      });
      await insertCycle(
        ctx,
        accountId,
        subscriptionId,
        Date.UTC(2026, 9, 1, 1)
      );
      await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_cycle", PASS_PRICE))
      );
      return {
        jobs: await scheduledNames(ctx),
        subscription: await ctx.db.get(subscriptionId),
      };
    });
    expect(result.subscription?.status).toBe("canceled");
    expect(result.jobs).not.toContainEqual(
      expect.stringContaining("deactivate")
    );
  });

  it("keeps the running period when the refund is of an earlier cycle", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, subscriptionId } = await seedRunningPlan(ctx);
      await insertCycle(ctx, accountId, subscriptionId, Date.UTC(2026, 8, 1));
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_cycle", PASS_PRICE))
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        subscription: await ctx.db.get(subscriptionId),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.payments).toMatchObject([{ status: "refunded" }]);
    expect(result.subscription).toMatchObject({
      currentPeriodEnd: FAR_FUTURE,
      status: "active",
    });
    expect(result.grants).toMatchObject([{ validTo: FAR_FUTURE }]);
  });

  it("records a cycle whose subscription is gone, or is on another rail, and stops nothing", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId, subscriptionId } = await seedRunningPlan(ctx, {
        provider: {
          kind: "polar",
          priceId: null,
          productId: "prod_1",
          subscriptionId: "sub_1",
        },
      });
      await insertCycle(
        ctx,
        accountId,
        subscriptionId,
        Date.UTC(2026, 9, 1, 1)
      );
      const otherRail = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_cycle", PASS_PRICE))
      );
      const subscription = await ctx.db.get(subscriptionId);
      const payment = await ctx.db.query("billingPayments").first();
      if (payment !== null) {
        await ctx.db.patch("billingPayments", payment._id, {
          status: "succeeded",
        });
      }
      await ctx.db.delete(subscriptionId);
      const gone = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_cycle", PASS_PRICE))
      );
      return { gone, otherRail, subscription };
    });
    expect(result.otherRail).toBe("applied");
    expect(result.subscription?.status).toBe("active");
    expect(result.gone).toBe("applied");
  });

  it("leaves a School invoice paid, for an operator to settle", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { accountId } = await seedXenditSubscription(ctx);
      const invoiceId = await ctx.db.insert("billingInvoices", {
        accountId,
        buyerTaxId: null,
        currency: "IDR",
        dueAt: 1,
        lines: [
          {
            amount: 100_000,
            description: "school.seat.year",
            quantity: 1,
            unitAmount: 100_000,
          },
        ],
        number: "NKF-2026-000009",
        paymentLink: null,
        periodEnd: 1,
        periodStart: 0,
        status: "paid",
        total: 100_000,
      });
      await ctx.db.insert("billingPayments", {
        accountId,
        amount: 100_000,
        currency: "IDR",
        invoiceId,
        kind: "invoice",
        method: "session",
        paidAt: 1,
        providerPaymentId: "py_invoice",
        providerUpdatedAt: 1,
        rail: "xendit",
        status: "succeeded",
      });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_invoice", 100_000))
      );
      return {
        invoice: await ctx.db.get(invoiceId),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.payments).toMatchObject([{ status: "refunded" }]);
    expect(result.invoice?.status).toBe("paid");
  });

  it("changes nothing for a partial refund, so the buyer keeps what they bought", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedXenditCheckout(ctx, "pro.pass.1");
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditSessionDelivery("payment_session.completed", "py_1")
        )
      );
      const before = await ctx.db.query("billingGrants").collect();
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_1", 10_000))
      );
      return {
        before,
        grants: await ctx.db.query("billingGrants").collect(),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.outcome).toBe("partial");
    expect(result.payments).toMatchObject([{ status: "succeeded" }]);
    expect(result.grants).toEqual(result.before);
  });

  it("reports a refund it cannot place, and ignores one that failed", async () => {
    const t = createBillingTestConvex();
    const outcomes = await t.run(async (ctx) => ({
      failed: await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("refund.failed", { refund_id: "rfd-1" })
        )
      ),
      invalid: await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("refund.succeeded", { refund_id: "rfd-1" })
        )
      ),
      unknown: await runInMutation(
        ctx,
        processXenditEvent(refundOf("py_unknown", PASS_PRICE))
      ),
    }));
    expect(outcomes).toEqual({
      failed: "ignored",
      invalid: "invalid",
      unknown: "unknownPayment",
    });
  });

  it("keeps a paid top-up on record and returns the money when Pro ended before it was paid", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedXenditCheckout(ctx, "pro.topup");
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditSessionDelivery("payment_session.completed", "py_1")
        )
      );
      return {
        lots: await ctx.db.query("creditLots").collect(),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      };
    });
    expect(result.outcome).toBe("applied");
    expect(result.payments).toMatchObject([{ kind: "credits" }]);
    expect(result.lots).toHaveLength(0);
    expect(result.scheduled).toContainEqual(
      expect.objectContaining({
        args: [
          expect.objectContaining({
            orderId: "py_1",
            rail: "xendit",
            refundableAmount: 59_000,
          }),
        ],
        name: expect.stringContaining("refundWithoutPro"),
      })
    );
  });
});
