import { describe, expect, it } from "@effect/vitest";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
  seedXenditSubscription,
  xenditCycle,
  xenditDelivery,
} from "@repo/backend/test/billing";
import { Array as Arr, Exit } from "effect";

describe("billing/xendit/process", () => {
  it("reads a body that is not an envelope as invalid", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run((ctx) =>
      runInMutation(ctx, processXenditEvent("not json"))
    );
    expect(outcome).toBe("invalid");
  });

  it("applies an activated plan to the stored subscription", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", {
            id: "repl_1",
            status: "ACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
      const stored = await ctx.db.get(subscriptionId);
      return {
        outcome,
        providerUpdatedAt: stored?.providerUpdatedAt,
        status: stored?.status,
      };
    });
    expect(result).toEqual({
      outcome: "applied",
      providerUpdatedAt: Date.UTC(2026, 9, 24),
      status: "active",
    });
  });

  it("cancels the subscription at the end of its period when its plan is inactivated", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.inactivated", {
            id: "repl_1",
            status: "INACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
      const stored = await ctx.db.get(subscriptionId);
      return {
        outcome,
        cancelAtPeriodEnd: stored?.cancelAtPeriodEnd,
        status: stored?.status,
      };
    });
    expect(result).toEqual({
      cancelAtPeriodEnd: true,
      outcome: "applied",
      status: "canceled",
    });
  });

  it("refuses a plan update older than the stored one", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", {
            id: "repl_1",
            status: "ACTIVE",
            updated: "2025-12-31T00:00:00Z",
          })
        )
      );
      return { outcome, status: (await ctx.db.get(subscriptionId))?.status };
    });
    expect(result).toEqual({ outcome: "stale", status: "pending" });
  });

  it("reports a plan Nakafa holds no row for", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", {
            id: "repl_other",
            status: "ACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
    });
    expect(outcome).toBe("unknownPlan");
  });

  it("refuses a plan event whose data does not decode", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", { id: "repl_1" })
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("does not change a subscription whose account is on another rail", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx, { rail: "polar" });
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", {
            id: "repl_1",
            status: "ACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
    });
    expect(outcome).toBe("railMismatch");
  });

  it("fails when the account of a stored subscription is gone", async () => {
    const t = createBillingTestConvex();
    const failed = await t.run(async (ctx) => {
      const { accountId } = await seedXenditSubscription(ctx);
      await ctx.db.delete(accountId);
      const exit = await exitInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.activated", {
            id: "repl_1",
            status: "ACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
      return Exit.isFailure(exit);
    });
    expect(failed).toBe(true);
  });

  it("records a successful cycle and grants its paid period", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      const stored = await ctx.db.get(subscriptionId);
      const payments = await ctx.db.query("billingPayments").collect();
      const grants = await ctx.db.query("billingGrants").collect();
      return {
        outcome,
        payments: Arr.map(payments, (payment) => ({
          amount: payment.amount,
          kind: payment.kind,
          method: payment.method,
          providerPaymentId: payment.providerPaymentId,
        })),
        periodEnd: stored?.currentPeriodEnd,
        periodStart: stored?.currentPeriodStart,
        grants: Arr.map(grants, (grant) => ({
          product: grant.product,
          validTo: grant.validTo,
        })),
        status: stored?.status,
      };
    });
    expect(result).toEqual({
      grants: [{ product: "pro", validTo: Date.UTC(2026, 10, 2) }],
      outcome: "applied",
      payments: [
        {
          amount: 79_000,
          kind: "cycle",
          method: "recurring",
          providerPaymentId: "py_cycle_1",
        },
      ],
      periodEnd: Date.UTC(2026, 10, 1),
      periodStart: Date.UTC(2026, 9, 1),
      status: "active",
    });
  });

  it("names the cycle as the payment when its succeeded attempt names none", async () => {
    const t = createBillingTestConvex();
    const providerPaymentId = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.succeeded",
            xenditCycle({
              attempt_details: [
                {
                  created: "2026-10-01T00:01:00Z",
                  payment_id: null,
                  status: "SUCCEEDED",
                },
              ],
            })
          )
        )
      );
      const payments = await ctx.db.query("billingPayments").collect();
      return payments[0]?.providerPaymentId;
    });
    expect(providerPaymentId).toBe("recy_1");
  });

  it("keeps a stale cycle's payment and leaves the subscription's state as it is", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx, {
        providerUpdatedAt: Date.UTC(2026, 9, 30),
      });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      const stored = await ctx.db.get(subscriptionId);
      const grants = await ctx.db.query("billingGrants").collect();
      const payments = await ctx.db.query("billingPayments").collect();
      return {
        grants: grants.length,
        outcome,
        payments: payments.length,
        status: stored?.status,
      };
    });
    expect(result).toEqual({
      grants: 0,
      outcome: "stale",
      payments: 1,
      status: "pending",
    });
  });

  it("refuses a successful cycle that names no successful attempt", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.succeeded",
            xenditCycle({
              attempt_details: [
                {
                  created: "2026-10-01T00:01:00Z",
                  payment_id: null,
                  status: "FAILED",
                },
              ],
            })
          )
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("refuses a successful cycle in a currency the catalog does not sell", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.succeeded",
            xenditCycle({ currency: "SGD" })
          )
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("refuses a successful cycle whose data does not decode", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", { id: "recy_1" })
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("reports a successful cycle for a plan Nakafa holds no row for", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.succeeded",
            xenditCycle({ plan_id: "repl_other" })
          )
        )
      );
    });
    expect(outcome).toBe("unknownPlan");
  });

  it("does not record a successful cycle on another rail", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx, { rail: "polar" });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      const payments = await ctx.db.query("billingPayments").collect();
      return { outcome, payments: payments.length };
    });
    expect(result).toEqual({ outcome: "railMismatch", payments: 0 });
  });

  it("marks a failed cycle past due and keeps its paid period", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedXenditSubscription(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.failed",
            xenditCycle({ status: "FAILED", updated: "2026-10-02T00:00:00Z" })
          )
        )
      );
      const stored = await ctx.db.get(subscriptionId);
      return { outcome, status: stored?.status };
    });
    expect(result).toEqual({ outcome: "applied", status: "pastDue" });
  });

  it("refuses a failed cycle whose data does not decode", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.failed", { id: "recy_1" })
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("reports a failed cycle for a plan Nakafa holds no row for", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.failed",
            xenditCycle({ plan_id: "repl_other", status: "FAILED" })
          )
        )
      );
    });
    expect(outcome).toBe("unknownPlan");
  });

  it("does not change a subscription for a failed cycle on another rail", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx, { rail: "polar" });
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.failed",
            xenditCycle({ status: "FAILED" })
          )
        )
      );
    });
    expect(outcome).toBe("railMismatch");
  });

  it("ignores a cycle that is only created", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.created",
            xenditCycle({ status: "SCHEDULED" })
          )
        )
      );
    });
    expect(outcome).toBe("ignored");
  });
});
