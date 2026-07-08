import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { tryoutEntitlementSourceKindSubscription } from "@repo/backend/convex/tryoutAccess/schema";
import { requireActiveEntitlement } from "@repo/backend/convex/tryouts/runtime/access";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const PERIOD_END = Date.UTC(2026, 6, 21, 12, 0, 0);

/** Inserts one user row for try-out access tests. */
async function insertUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    authId: "auth-tryout-access",
    credits: 10,
    creditsResetAt: NOW,
    email: "tryout-access@example.com",
    name: "Tryout Access",
    plan: "pro",
  });
}

/** Inserts one Polar customer row linked to the user. */
async function insertCustomer(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.insert("customers", {
    externalId: null,
    id: "polar-tryout-access",
    metadata: {},
    userId,
  });
}

/** Inserts one subscription row with a stable period. */
async function insertSubscription(
  ctx: MutationCtx,
  args: {
    currentPeriodEnd?: string | null;
    status: string;
    subscriptionId: string;
  }
) {
  const timestamp = new Date(NOW).toISOString();
  let currentPeriodEnd: string | null = new Date(PERIOD_END).toISOString();

  if (args.currentPeriodEnd !== undefined) {
    currentPeriodEnd = args.currentPeriodEnd;
  }

  return await ctx.db.insert("subscriptions", {
    amount: null,
    cancelAtPeriodEnd: false,
    checkoutId: null,
    createdAt: timestamp,
    currency: null,
    currentPeriodEnd,
    currentPeriodStart: timestamp,
    customerId: "polar-tryout-access",
    endedAt: null,
    id: args.subscriptionId,
    metadata: {},
    modifiedAt: null,
    productId: products.pro.id,
    recurringInterval: null,
    startedAt: timestamp,
    status: args.status,
  });
}

describe("tryouts/runtime/access", () => {
  it("creates an exam entitlement from an active Pro subscription", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      await insertSubscription(ctx, {
        status: "active",
        subscriptionId: "sub-active-pro",
      });

      const entitlement = await requireActiveEntitlement(ctx, {
        countryKey: "indonesia",
        examKey: "snbt",
        now: NOW,
        setKey: "set-1",
        userId,
      });
      const entitlements = await ctx.db.query("tryoutEntitlements").collect();

      return { entitlement, entitlements };
    });

    expect(result.entitlement).toMatchObject({
      countryKey: "indonesia",
      endsAt: PERIOD_END,
      examKey: "snbt",
      sourceKind: tryoutEntitlementSourceKindSubscription,
      startsAt: NOW,
      subscriptionId: "sub-active-pro",
    });
    expect(result.entitlement).not.toHaveProperty("setKey");
    expect(result.entitlements).toHaveLength(1);
  });

  it("rejects a cached subscription entitlement when the subscription is not active", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        await insertCustomer(ctx, userId);
        await insertSubscription(ctx, {
          status: "canceled",
          subscriptionId: "sub-canceled-pro",
        });
        await ctx.db.insert("tryoutEntitlements", {
          countryKey: "indonesia",
          endsAt: PERIOD_END,
          examKey: "snbt",
          sourceKind: tryoutEntitlementSourceKindSubscription,
          startsAt: NOW,
          subscriptionId: "sub-canceled-pro",
          userId,
        });

        await requireActiveEntitlement(ctx, {
          countryKey: "indonesia",
          examKey: "snbt",
          now: NOW,
          setKey: "set-1",
          userId,
        });
      })
    ).rejects.toThrow("Try-out access is required for this set.");
  });

  it("creates an unbounded entitlement from an active Pro subscription without a period end", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      await insertSubscription(ctx, {
        currentPeriodEnd: null,
        status: "active",
        subscriptionId: "sub-active-pro-without-period",
      });

      return await requireActiveEntitlement(ctx, {
        countryKey: "indonesia",
        examKey: "snbt",
        now: NOW,
        setKey: "set-1",
        userId,
      });
    });

    expect(result).toMatchObject({
      countryKey: "indonesia",
      endsAt: Number.MAX_SAFE_INTEGER,
      examKey: "snbt",
      sourceKind: tryoutEntitlementSourceKindSubscription,
      startsAt: NOW,
      subscriptionId: "sub-active-pro-without-period",
    });
  });

  it("rejects active Pro subscriptions with an invalid period end", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        await insertCustomer(ctx, userId);
        await insertSubscription(ctx, {
          currentPeriodEnd: "not-a-date",
          status: "active",
          subscriptionId: "sub-active-pro-invalid-period",
        });

        await requireActiveEntitlement(ctx, {
          countryKey: "indonesia",
          examKey: "snbt",
          now: NOW,
          setKey: "set-1",
          userId,
        });
      })
    ).rejects.toThrow("Try-out access is required for this set.");
  });
});
