import { beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertSchool,
  polarProSubscriptionBody,
} from "@repo/backend/test/billing";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** The instant the sweep tests run at: the sweep reads the clock, so the tests fix it. */
const SWEEP_NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SWEEP_NOW);
});

/** Stores one Polar delivery the way the webhook inbox does, without scheduling its processing, so only the sweep runs. */
function insertDelivery(
  ctx: MutationCtx,
  key: string,
  payload: string,
  receivedAt: number
) {
  return ctx.db.insert("billingEvents", {
    rail: "polar",
    key,
    type: "subscription.created",
    providerTime: receivedAt,
    payload,
    receivedAt,
    processedAt: null,
  });
}

describe("billing/sweep", () => {
  it("reapplies a Polar delivery unprocessed past five minutes, and leaves a younger one for its scheduled run", async () => {
    const t = createBillingTestConvex();
    const ids = await t.run(async (ctx) => ({
      older: await insertDelivery(
        ctx,
        "sweep-older",
        "{}",
        SWEEP_NOW - 10 * MINUTE_MS
      ),
      younger: await insertDelivery(
        ctx,
        "sweep-younger",
        "{}",
        SWEEP_NOW - MINUTE_MS
      ),
    }));
    expect(await t.action(internal.billing.events.sweep, {})).toBe(1);
    const stored = await t.run(async (ctx) => ({
      older: (await ctx.db.get(ids.older))?.processedAt,
      younger: (await ctx.db.get(ids.younger))?.processedAt,
    }));
    expect(stored.older).toBe(SWEEP_NOW);
    expect(stored.younger).toBeNull();
  });

  it("neither reapplies nor gives up a delivery that is only just past its window", async () => {
    const t = createBillingTestConvex();
    const ids = await t.run(async (ctx) => ({
      ancient: await insertDelivery(
        ctx,
        "sweep-ancient",
        "{}",
        SWEEP_NOW - 3 * DAY_MS - 60 * MINUTE_MS
      ),
      crossing: await insertDelivery(
        ctx,
        "sweep-crossing",
        "{}",
        SWEEP_NOW - 3 * DAY_MS - 2 * MINUTE_MS
      ),
    }));
    expect(await t.action(internal.billing.events.sweep, {})).toBe(0);
    const stored = await t.run(async (ctx) => ({
      ancient: (await ctx.db.get(ids.ancient))?.processedAt,
      crossing: (await ctx.db.get(ids.crossing))?.processedAt,
    }));
    expect(stored).toEqual({ ancient: null, crossing: null });
  });

  it("keeps a delivery that cannot be applied unprocessed, and still reapplies the rest", async () => {
    const t = createBillingTestConvex();
    const ids = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "polar",
        country: "ID",
        currency: "IDR",
        providerCustomerId: "cust_school_polar",
      });
      return {
        failing: await insertDelivery(
          ctx,
          "sweep-failing",
          polarProSubscriptionBody("cust_school_polar"),
          SWEEP_NOW - 20 * MINUTE_MS
        ),
        fine: await insertDelivery(
          ctx,
          "sweep-fine",
          "{}",
          SWEEP_NOW - 15 * MINUTE_MS
        ),
      };
    });
    expect(await t.action(internal.billing.events.sweep, {})).toBe(2);
    const stored = await t.run(async (ctx) => ({
      failing: (await ctx.db.get(ids.failing))?.processedAt,
      fine: (await ctx.db.get(ids.fine))?.processedAt,
    }));
    expect(stored.failing).toBeNull();
    expect(stored.fine).toBe(SWEEP_NOW);
  });
});
