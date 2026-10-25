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
import { Array as Arr, Effect, Logger, MutableRef } from "effect";

const CUSTOMER = "cust_polar_webhook";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PAID_END = Date.parse("2026-11-01T00:00:00.000Z");
/** The instant an incomplete subscription is processed at, fixed so the grant's end is exact. */
const INCOMPLETE_AT = Date.UTC(2026, 9, 25, 12, 0, 0);

/** Applies one Polar delivery through the webhook path and returns the outcome it reports. */
function applyBody(
  t: ReturnType<typeof createBillingTestConvex>,
  body: string
) {
  return t.mutation((ctx) => runInMutation(ctx, processPolarEvent(body)));
}

/** The grants the billing model holds, as stored. */
function readGrants(t: ReturnType<typeof createBillingTestConvex>) {
  return t.run((ctx) => ctx.db.query("billingGrants").collect());
}

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
  it("applies a created subscription to its account and writes the grant of its paid period, with a day of renewal grace", async () => {
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
        validTo: Date.parse("2026-11-02T00:00:00.000Z"),
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
    expect(outcome).toEqual({
      kind: "unknownCustomer",
      customerId: "cust_someone_else",
    });
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

  it("keeps exactly the paid period when the subscription cancels at its period end", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(
      t,
      subscriptionEvent("subscription.created", { cancel_at_period_end: true })
    );
    expect(await readGrants(t)).toMatchObject([{ validTo: PAID_END }]);
  });

  it("ends the grant at the failed payment, not at the period Polar advanced to", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(t, subscriptionEvent("subscription.created"));
    await applyBody(
      t,
      subscriptionEvent("subscription.past_due", {
        current_period_end: "2026-12-01T00:00:00.000Z",
        current_period_start: "2026-11-01T00:00:00.000Z",
        modified_at: "2026-11-01T00:01:00.000Z",
        past_due_at: "2026-11-01T00:00:00.000Z",
        status: "past_due",
      })
    );
    expect(await readGrants(t)).toMatchObject([{ validTo: PAID_END }]);
  });

  it("never extends a grant that already ends before a later failed payment", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(t, subscriptionEvent("subscription.created"));
    await applyBody(
      t,
      subscriptionEvent("subscription.past_due", {
        current_period_end: "2026-12-05T00:00:00.000Z",
        current_period_start: "2026-11-05T00:00:00.000Z",
        modified_at: "2026-11-05T00:01:00.000Z",
        past_due_at: "2026-11-05T00:00:00.000Z",
        status: "past_due",
      })
    );
    expect(await readGrants(t)).toMatchObject([
      { validTo: PAID_END + ONE_DAY_MS },
    ]);
  });

  it("ends the grant at the time a canceled subscription ended", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(t, subscriptionEvent("subscription.created"));
    await applyBody(
      t,
      subscriptionEvent("subscription.canceled", {
        ended_at: "2026-10-20T00:00:00.000Z",
        modified_at: "2026-10-20T00:00:00.000Z",
        status: "canceled",
      })
    );
    expect(await readGrants(t)).toMatchObject([
      { validTo: Date.parse("2026-10-20T00:00:00.000Z") },
    ]);
  });

  it("grants nothing for an incomplete subscription that expired unpaid", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(
      t,
      subscriptionEvent("subscription.created", {
        status: "incomplete_expired",
      })
    );
    expect(await readGrants(t)).toEqual([]);
  });

  it("ends the grant now when a subscription turns incomplete", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INCOMPLETE_AT);
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(t, subscriptionEvent("subscription.created"));
    await applyBody(
      t,
      subscriptionEvent("subscription.updated", {
        modified_at: "2026-10-21T00:00:00.000Z",
        status: "incomplete",
      })
    );
    const grants = await readGrants(t);
    expect(grants).toHaveLength(1);
    expect(grants[0]?.validTo).toBe(INCOMPLETE_AT);
  });

  it("logs a subscription Nakafa does not sell at error level", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    const logged = MutableRef.make<readonly { readonly level: string }[]>([]);
    const loggerLayer = Logger.layer([
      Logger.formatStructured.pipe(
        Logger.map(({ level }) =>
          MutableRef.update(logged, Arr.append({ level }))
        )
      ),
    ]);
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        processPolarEvent(
          subscriptionEvent("subscription.created", {
            product_id: "another-product",
          })
        ).pipe(Effect.provide(loggerLayer))
      )
    );
    expect(
      Arr.filter(MutableRef.get(logged), (entry) => entry.level === "ERROR")
    ).toHaveLength(1);
  });

  it("writes no grant for an active subscription that Polar sends without a period end", async () => {
    const t = createBillingTestConvex();
    await t.mutation((ctx) => seed(ctx));
    await applyBody(
      t,
      subscriptionEvent("subscription.created", { current_period_end: null })
    );
    expect(await readGrants(t)).toEqual([]);
  });
});
