import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  tryoutEntitlementSourceKindCompetition,
  tryoutEntitlementSourceKindSubscription,
} from "@repo/backend/convex/tryoutAccess/schema";
import { getIncludedAttemptAccess } from "@repo/backend/convex/tryouts/access/impl";
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

/** Resolves included access for one test scope through the Effect boundary. */
function resolveAccess(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { setKey?: string; trackKey?: string } = {}
) {
  return runConvexProgram(
    getIncludedAttemptAccess(ctx, {
      countryKey: "indonesia",
      examKey: "snbt",
      now: NOW,
      setKey: args.setKey ?? "set-1",
      trackKey: args.trackKey ?? "2027",
      userId,
    })
  );
}

describe("tryouts/access/impl", () => {
  it("creates an exam entitlement from an active Pro subscription", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      await insertSubscription(ctx, {
        status: "active",
        subscriptionId: "sub-active-pro",
      });

      const access = await resolveAccess(ctx, userId);
      const entitlements = await ctx.db.query("tryoutEntitlements").collect();

      return { access, entitlements };
    });

    expect(result.access).toEqual({
      accessEndsAt: PERIOD_END,
      accessSourceKind: tryoutEntitlementSourceKindSubscription,
      accessSubscriptionId: "sub-active-pro",
      countsForCompetition: false,
    });
    expect(result.entitlements).toHaveLength(1);
    expect(result.entitlements[0]).toMatchObject({
      countryKey: "indonesia",
      examKey: "snbt",
      sourceKind: tryoutEntitlementSourceKindSubscription,
      subscriptionId: "sub-active-pro",
    });
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

        return await resolveAccess(ctx, userId);
      })
    ).resolves.toBeNull();
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

      return await resolveAccess(ctx, userId);
    });

    expect(result).toEqual({
      accessEndsAt: Number.MAX_SAFE_INTEGER,
      accessSourceKind: tryoutEntitlementSourceKindSubscription,
      accessSubscriptionId: "sub-active-pro-without-period",
      countsForCompetition: false,
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

        return await resolveAccess(ctx, userId);
      })
    ).resolves.toBeNull();
  });

  it("rejects set entitlements from a different track", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await insertUser(ctx);

      await ctx.db.insert("tryoutEntitlements", {
        countryKey: "indonesia",
        endsAt: PERIOD_END,
        examKey: "snbt",
        setKey: "set-1",
        sourceKind: tryoutEntitlementSourceKindCompetition,
        startsAt: NOW,
        trackKey: "2027",
        userId: insertedUserId,
      });

      return insertedUserId;
    });
    const matching = await t.mutation((ctx) => resolveAccess(ctx, userId));

    expect(matching).toMatchObject({
      accessSourceKind: tryoutEntitlementSourceKindCompetition,
      countsForCompetition: true,
    });
    await expect(
      t.mutation((ctx) => resolveAccess(ctx, userId, { trackKey: "2028" }))
    ).resolves.toBeNull();
  });

  it("accepts track entitlements for sets in the same track", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await insertUser(ctx);

      await ctx.db.insert("tryoutEntitlements", {
        countryKey: "indonesia",
        endsAt: PERIOD_END,
        examKey: "snbt",
        sourceKind: tryoutEntitlementSourceKindCompetition,
        startsAt: NOW,
        trackKey: "2027",
        userId: insertedUserId,
      });

      return insertedUserId;
    });
    const matching = await t.mutation((ctx) =>
      resolveAccess(ctx, userId, { setKey: "set-2" })
    );

    expect(matching).toMatchObject({
      accessSourceKind: tryoutEntitlementSourceKindCompetition,
      countsForCompetition: true,
    });
    await expect(
      t.mutation((ctx) =>
        resolveAccess(ctx, userId, {
          setKey: "set-2",
          trackKey: "2028",
        })
      )
    ).resolves.toBeNull();
  });
});
