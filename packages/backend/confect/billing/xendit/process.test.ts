import { describe, expect, it } from "@effect/vitest";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Exit } from "effect";

/** The provider time the seeded subscription already holds. */
const STORED = Date.UTC(2026, 0, 1);

/** One Xendit delivery body, as the route stores it. */
function body(event: string, data: unknown): string {
  return encodeJsonText({
    business_id: "biz_1",
    created: "2026-10-24T00:00:00Z",
    data,
    event,
  });
}

/** One recurring cycle, paid in its first attempt unless a test overrides a field. */
function cycle(overrides: Record<string, unknown> = {}) {
  return {
    amount: 79_000,
    attempt_details: [
      {
        created: "2026-10-01T00:01:00Z",
        payment_id: "py_cycle_1",
        status: "SUCCEEDED",
      },
    ],
    currency: "IDR",
    id: "recy_1",
    plan_id: "repl_1",
    scheduled_timestamp: "2026-10-01T00:00:00Z",
    status: "SUCCEEDED",
    updated: "2026-10-01T00:05:00Z",
    ...overrides,
  };
}

/** Stores a pending Xendit subscription of Pro, on a personal account of the given rail. */
async function seed(
  ctx: MutationCtx,
  options: {
    planId?: string;
    providerUpdatedAt?: number;
    rail?: "polar" | "xendit";
  } = {}
) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-xendit-${options.planId ?? "plan"}-${options.rail ?? "xendit"}`,
    credits: 0,
    creditsResetAt: 0,
    email: "xendit-process@example.com",
    mascot: MASCOT_CODE,
    name: "Xendit Process",
    plan: "free",
  });
  const accountId = await ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: options.rail ?? "xendit",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
  const subscriptionId = await ctx.db.insert("billingSubscriptions", {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: "pending",
    currentPeriodStart: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    provider: {
      kind: "xendit",
      planId: options.planId ?? "repl_1",
      tokenId: null,
      channel: "DANA",
    },
    providerUpdatedAt: options.providerUpdatedAt ?? STORED,
  });
  return { accountId, subscriptionId, userId };
}

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
      const { subscriptionId } = await seed(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.activated", {
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
      const { subscriptionId } = await seed(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.inactivated", {
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
      const { subscriptionId } = await seed(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.activated", {
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
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.activated", {
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
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(body("recurring.plan.activated", { id: "repl_1" }))
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("does not change a subscription whose account is on another rail", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx, { rail: "polar" });
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.activated", {
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
      const { accountId } = await seed(ctx);
      await ctx.db.delete(accountId);
      const exit = await exitInMutation(
        ctx,
        processXenditEvent(
          body("recurring.plan.activated", {
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
      const { subscriptionId } = await seed(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(body("recurring.cycle.succeeded", cycle()))
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
      grants: [{ product: "pro", validTo: Date.UTC(2026, 10, 1) }],
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
      await seed(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          body(
            "recurring.cycle.succeeded",
            cycle({
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
      const { subscriptionId } = await seed(ctx, {
        providerUpdatedAt: Date.UTC(2026, 9, 30),
      });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(body("recurring.cycle.succeeded", cycle()))
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
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body(
            "recurring.cycle.succeeded",
            cycle({
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
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.cycle.succeeded", cycle({ currency: "SGD" }))
        )
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("refuses a successful cycle whose data does not decode", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(body("recurring.cycle.succeeded", { id: "recy_1" }))
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("reports a successful cycle for a plan Nakafa holds no row for", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.cycle.succeeded", cycle({ plan_id: "repl_other" }))
        )
      );
    });
    expect(outcome).toBe("unknownPlan");
  });

  it("does not record a successful cycle on another rail", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seed(ctx, { rail: "polar" });
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(body("recurring.cycle.succeeded", cycle()))
      );
      const payments = await ctx.db.query("billingPayments").collect();
      return { outcome, payments: payments.length };
    });
    expect(result).toEqual({ outcome: "railMismatch", payments: 0 });
  });

  it("marks a failed cycle past due and keeps its paid period", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seed(ctx);
      const outcome = await runInMutation(
        ctx,
        processXenditEvent(
          body(
            "recurring.cycle.failed",
            cycle({ status: "FAILED", updated: "2026-10-02T00:00:00Z" })
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
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(body("recurring.cycle.failed", { id: "recy_1" }))
      );
    });
    expect(outcome).toBe("invalid");
  });

  it("reports a failed cycle for a plan Nakafa holds no row for", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body(
            "recurring.cycle.failed",
            cycle({ plan_id: "repl_other", status: "FAILED" })
          )
        )
      );
    });
    expect(outcome).toBe("unknownPlan");
  });

  it("does not change a subscription for a failed cycle on another rail", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx, { rail: "polar" });
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.cycle.failed", cycle({ status: "FAILED" }))
        )
      );
    });
    expect(outcome).toBe("railMismatch");
  });

  it("ignores a cycle that is only created", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.run(async (ctx) => {
      await seed(ctx);
      return runInMutation(
        ctx,
        processXenditEvent(
          body("recurring.cycle.created", cycle({ status: "SCHEDULED" }))
        )
      );
    });
    expect(outcome).toBe("ignored");
  });
});
