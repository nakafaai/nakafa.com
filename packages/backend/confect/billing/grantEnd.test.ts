import { describe, expect, it } from "@effect/vitest";
import { endSubscriptionGrant } from "@repo/backend/confect/billing/grantEnd";
import {
  projectUserPlan,
  syncSubscriptionGrant,
} from "@repo/backend/confect/billing/grants";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertProSubscription,
  PRO_PERIOD_END,
  readGrantEnds,
  runInMutation,
  seedXenditSubscription,
  xenditCycle,
  xenditDelivery,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

const DAY_MS = 24 * 60 * 60 * 1000;
/** An instant one day before the Pro period ends, when a grant is cut short. */
const ENDS_EARLY = PRO_PERIOD_END - DAY_MS;

/** Inserts a free user with a Polar account and one active Pro subscription on it. */
async function seedProSubscription(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-grant-end",
    credits: 0,
    creditsResetAt: 0,
    email: "grant-end@example.com",
    mascot: MASCOT_CODE,
    name: "Grant End",
    plan: "free",
  });
  const accountId = await insertPolarAccount(ctx, userId, null);
  const subscriptionId = await insertProSubscription(ctx, accountId, {
    subscriptionId: "sub_grant_end",
  });
  return { subscriptionId, userId };
}

describe("billing/grantEnd", () => {
  it("ends a grant at an earlier time, and never extends it", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId, userId } = await seedProSubscription(ctx);
      await runInMutation(ctx, syncSubscriptionGrant(subscriptionId));
      const ended = await runInMutation(
        ctx,
        endSubscriptionGrant(subscriptionId, ENDS_EARLY)
      );
      const endedAgain = await runInMutation(
        ctx,
        endSubscriptionGrant(subscriptionId, PRO_PERIOD_END)
      );
      const grants = await ctx.db.query("billingGrants").collect();
      const plan = await runInMutation(
        ctx,
        projectUserPlan(userId, ENDS_EARLY + 1)
      );
      return {
        endedAgainIsNone: endedAgain === null,
        endedIsSome: ended !== null,
        plan,
        validTo: grants[0]?.validTo,
      };
    });
    expect(result).toEqual({
      endedAgainIsNone: true,
      endedIsSome: true,
      plan: "free",
      validTo: ENDS_EARLY,
    });
  });

  it("returns nothing for a subscription that holds no grant", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { subscriptionId } = await seedProSubscription(ctx);
      return runInMutation(
        ctx,
        endSubscriptionGrant(subscriptionId, ENDS_EARLY)
      );
    });
    expect(result).toBeNull();
  });

  it("ends a school subscription's grant at the given time", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Akhir",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-akhir",
        status: "active",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "polar",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const subscriptionId = await ctx.db.insert("billingSubscriptions", {
        accountId,
        offer: "school.seat.month",
        quantity: 3,
        status: "active",
        currentPeriodStart: PRO_PERIOD_END - 30 * DAY_MS,
        currentPeriodEnd: PRO_PERIOD_END,
        cancelAtPeriodEnd: false,
        provider: {
          kind: "polar",
          subscriptionId: "sub_school_end",
          productId: "prod_school_end",
          priceId: null,
        },
        providerUpdatedAt: 0,
      });
      await runInMutation(ctx, syncSubscriptionGrant(subscriptionId));
      const ended = await runInMutation(
        ctx,
        endSubscriptionGrant(subscriptionId, ENDS_EARLY)
      );
      const grants = await ctx.db.query("billingGrants").collect();
      return { ended: ended !== null, validTo: grants[0]?.validTo };
    });
    expect(result).toEqual({ ended: true, validTo: ENDS_EARLY });
  });

  it("ends a renewed grant at the paid period when a later cycle fails", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      const renewed = await readGrantEnds(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.failed",
            xenditCycle({ status: "FAILED", updated: "2026-10-02T00:00:00Z" })
          )
        )
      );
      return { failed: await readGrantEnds(ctx), renewed };
    });
    expect(result).toEqual({
      failed: [Date.UTC(2026, 10, 1)],
      renewed: [Date.UTC(2026, 10, 2)],
    });
  });

  it("ends a renewed grant at the paid period when its plan is turned off", async () => {
    const t = createBillingTestConvex();
    const ends = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.plan.inactivated", {
            id: "repl_1",
            status: "INACTIVE",
            updated: "2026-10-24T00:00:00Z",
          })
        )
      );
      return readGrantEnds(ctx);
    });
    expect(ends).toEqual([Date.UTC(2026, 10, 1)]);
  });

  it("keeps the grant of a failed cycle that is older than the stored state", async () => {
    const t = createBillingTestConvex();
    const ends = await t.run(async (ctx) => {
      await seedXenditSubscription(ctx);
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("recurring.cycle.succeeded", xenditCycle())
        )
      );
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery(
            "recurring.cycle.failed",
            xenditCycle({ status: "FAILED", updated: "2026-10-01T00:00:00Z" })
          )
        )
      );
      return readGrantEnds(ctx);
    });
    expect(ends).toEqual([Date.UTC(2026, 10, 2)]);
  });
});
