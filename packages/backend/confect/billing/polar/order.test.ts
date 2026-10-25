import { describe, expect, it } from "@effect/vitest";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { processPolarEvent } from "@repo/backend/confect/billing/polar/webhook";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertSchool,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { encodeJsonText } from "@repo/utilities/json";

const CUSTOMER = "cust_polar_order";
/** The Nina credit pack's Polar product on the sandbox server the tests bill through. */
const TOPUP_PRODUCT = polarProductIdFor("pro.topup", "sandbox");

/** One order webhook body as Polar sends it, with the fields a test changes. */
function orderEvent(
  type: string,
  overrides: Record<string, unknown> = {}
): string {
  return encodeJsonText({
    data: {
      created_at: "2026-10-25T12:00:00.000Z",
      currency: "usd",
      customer_id: CUSTOMER,
      id: "order_webhook_1",
      modified_at: "2026-10-25T12:00:00.000Z",
      paid: true,
      product_id: TOPUP_PRODUCT,
      refundable_amount: 499,
      refunded_amount: 0,
      subscription_id: null,
      total_amount: 499,
      ...overrides,
    },
    timestamp: "2026-10-25T12:00:00.000Z",
    type,
  });
}

/** Seeds a learner on Pro with a personal Polar account linked to the webhook customer. */
async function seedProLearner(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-polar-topup",
    credits: 0,
    creditsResetAt: 0,
    email: "polar-topup@example.com",
    mascot: MASCOT_CODE,
    name: "Polar Topup",
    plan: "pro",
  });
  await ctx.db.insert("billingGrants", {
    product: "pro",
    source: { kind: "contract", contractId: "contract-polar-topup" },
    userId,
    validFrom: Date.UTC(2026, 9, 1),
    validTo: Date.UTC(2027, 9, 1),
  });
  await insertPolarAccount(ctx, userId, CUSTOMER);
  return userId;
}

describe("billing/polar/order", () => {
  it("grants a pack for a paid top-up order, once, and ignores renewals and other products", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seedProLearner(ctx));
    const paid = orderEvent("order.paid");
    expect(
      await t.mutation((ctx) => runInMutation(ctx, processPolarEvent(paid)))
    ).toBe("applied");
    expect(
      await t.mutation((ctx) => runInMutation(ctx, processPolarEvent(paid)))
    ).toBe("duplicate");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.paid", { subscription_id: "sub_renewal" })
          )
        )
      )
    ).toBe("ignored");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.paid", { product_id: "pdt_other" })
          )
        )
      )
    ).toBe("ignored");
    const stored = await t.run(async (ctx) => ({
      lots: await ctx.db.query("creditLots").collect(),
    }));
    expect(stored.lots).toMatchObject([{ remaining: 1000, state: "active" }]);
  });

  it("removes the unused credits of a refunded order, and ignores a refund that refunds nothing", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seedProLearner(ctx));
    await t.mutation((ctx) =>
      runInMutation(ctx, processPolarEvent(orderEvent("order.paid")))
    );
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.refunded", { refunded_amount: 0 })
          )
        )
      )
    ).toBe("ignored");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.refunded", {
              modified_at: "2026-10-25T13:00:00.000Z",
              refundable_amount: 0,
              refunded_amount: 499,
            })
          )
        )
      )
    ).toBe("applied");
    const stored = await t.run(async (ctx) => ({
      lots: await ctx.db.query("creditLots").collect(),
      payments: await ctx.db.query("billingPayments").collect(),
    }));
    expect(stored.lots).toMatchObject([{ remaining: 0, state: "refunded" }]);
    expect(stored.payments).toMatchObject([
      { kind: "credits", status: "refunded" },
    ]);
  });

  it("reports an order it cannot place: an unknown customer, a school owner, an unknown currency, and a body that does not decode", async () => {
    const t = createBillingTestConvex();
    await t.mutation(async (ctx) => {
      await seedProLearner(ctx);
      const tenantId = await insertSchool(ctx);
      await ctx.db.insert("billingAccounts", {
        country: "ID",
        currency: "IDR",
        owner: { kind: "tenant", tenantId },
        providerCustomerId: "cust_school",
        rail: "polar",
      });
    });
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.paid", { customer_id: "cust_nobody" })
          )
        )
      )
    ).toBe("unknownCustomer");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(
            orderEvent("order.paid", { customer_id: "cust_school" })
          )
        )
      )
    ).toBe("unsupported");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(orderEvent("order.paid", { currency: "zzz" }))
        )
      )
    ).toBe("unsupported");
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(orderEvent("order.paid", { total_amount: "499" }))
        )
      )
    ).toBe("invalid");
  });

  it("dates an order Polar never modified by the time it was created", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seedProLearner(ctx));
    expect(
      await t.mutation((ctx) =>
        runInMutation(
          ctx,
          processPolarEvent(orderEvent("order.paid", { modified_at: null }))
        )
      )
    ).toBe("applied");
    const payments = await t.run((ctx) =>
      ctx.db.query("billingPayments").collect()
    );
    expect(payments).toMatchObject([
      {
        paidAt: Date.parse("2026-10-25T12:00:00.000Z"),
        providerUpdatedAt: Date.parse("2026-10-25T12:00:00.000Z"),
      },
    ]);
  });
});
