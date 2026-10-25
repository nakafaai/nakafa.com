import { describe, expect, it } from "@effect/vitest";
import { proProductIds } from "@repo/backend/confect/billing/polar/catalog";
import { processPolarEvent } from "@repo/backend/confect/billing/polar/webhook";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { encodeJsonText } from "@repo/utilities/json";

const CUSTOMER = "cust_polar_webhook";

/** One subscription webhook body as Polar sends it, with the fields a test changes. */
function subscriptionEvent(
  type: string,
  overrides: Record<string, unknown> = {}
): string {
  return encodeJsonText({
    data: {
      cancel_at_period_end: false,
      created_at: "2026-10-01T00:00:00.000Z",
      current_period_end: "2026-11-01T00:00:00.000Z",
      current_period_start: "2026-10-01T00:00:00.000Z",
      customer_id: CUSTOMER,
      ended_at: null,
      id: "sub_webhook_1",
      modified_at: "2026-10-02T00:00:00.000Z",
      price_id: null,
      product_id: proProductIds.sandbox,
      recurring_interval: "month",
      status: "active",
      ...overrides,
    },
    timestamp: "2026-10-02T00:00:00.000Z",
    type,
  });
}

/** Seeds a user with a Polar account linked to the webhook customer. */
async function seed(ctx: MutationCtx, customer = CUSTOMER) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-polar-webhook",
    credits: 0,
    creditsResetAt: 0,
    email: "polar-webhook@example.com",
    mascot: MASCOT_CODE,
    name: "Polar Webhook",
    plan: "free",
  });
  return insertPolarAccount(ctx, userId, customer);
}

describe("billing/polar/webhook", () => {
  it("applies a created subscription to its account and writes the grant of its paid period", async () => {
    const t = createBillingTestConvex();
    await t.mutation(async (ctx) => {
      await seed(ctx);
    });
    const outcome = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(subscriptionEvent("subscription.created"))
      )
    );
    expect(outcome).toBe("applied");
    const stored = await t.run(async (ctx) => ({
      grants: await ctx.db.query("billingGrants").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(stored.subscriptions).toMatchObject([
      {
        offer: "pro.monthly",
        provider: { kind: "polar", subscriptionId: "sub_webhook_1" },
        status: "active",
      },
    ]);
    expect(stored.grants).toMatchObject([
      {
        product: "pro",
        validTo: Date.parse("2026-11-01T00:00:00.000Z"),
      },
    ]);
  });

  it("applies a redelivered state once: the subscription and its grant are updated, never duplicated", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const body = subscriptionEvent("subscription.updated");
    expect(
      await t.mutation((ctx) => runInMutation(ctx, processPolarEvent(body)))
    ).toBe("applied");
    expect(
      await t.mutation((ctx) => runInMutation(ctx, processPolarEvent(body)))
    ).toBe("applied");
    const stored = await t.run(async (ctx) => ({
      grants: await ctx.db.query("billingGrants").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(stored.subscriptions).toHaveLength(1);
    expect(stored.grants).toHaveLength(1);
  });

  it("refuses a state older than the stored one, so a late delivery never moves a subscription back", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.updated", {
            modified_at: "2026-10-05T00:00:00.000Z",
          })
        )
      )
    );
    const late = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.canceled", {
            modified_at: "2026-10-03T00:00:00.000Z",
            status: "canceled",
          })
        )
      )
    );
    expect(late).toBe("stale");
    const stored = await t.run((ctx) =>
      ctx.db.query("billingSubscriptions").first()
    );
    expect(stored).toMatchObject({ status: "active" });
  });

  it("writes no grant for a subscription that is still pending payment", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const outcome = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.created", {
            status: "incomplete",
          })
        )
      )
    );
    expect(outcome).toBe("applied");
    expect(
      await t.run((ctx) => ctx.db.query("billingGrants").collect())
    ).toEqual([]);
  });

  it("names a customer Nakafa holds no account for, and changes nothing", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const outcome = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.created", {
            customer_id: "cust_someone_else",
          })
        )
      )
    );
    expect(outcome).toBe("unknownCustomer");
    expect(
      await t.run((ctx) => ctx.db.query("billingSubscriptions").collect())
    ).toEqual([]);
  });

  it("reports a subscription Nakafa does not sell as unsupported", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const outcome = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.created", {
            product_id: "another-product",
          })
        )
      )
    );
    expect(outcome).toBe("unsupported");
  });

  it("reports a body that does not decode, or a subscription that does not match its contract, as invalid", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const notJson = await t.mutation((ctx) =>
      runInMutation(ctx, processPolarEvent("not json"))
    );
    const badData = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          encodeJsonText({ data: {}, type: "subscription.created" })
        )
      )
    );
    expect([notJson, badData]).toEqual(["invalid", "invalid"]);
  });

  it("ignores an event that changes no subscription", async () => {
    const t = createBillingTestConvex();
    const outcome = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          encodeJsonText({ data: {}, type: "customer.created" })
        )
      )
    );
    expect(outcome).toBe("ignored");
  });
});
