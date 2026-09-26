import { afterEach, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  getIncludedAttemptAccess,
  getTryoutStartAccess,
} from "@repo/backend/convex/tryouts/access/impl";
import { TryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { Effect } from "effect";

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
    productId?: string;
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
    productId: args.productId ?? products.pro.id,
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([null, new Date(PERIOD_END).toISOString()])(
    "reads subscription attribution without materializing an entitlement: %s",
    async (currentPeriodEnd) => {
      const t = convexTest(schema, convexModules);
      const result = await t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        await insertCustomer(ctx, userId);
        await insertSubscription(ctx, {
          currentPeriodEnd,
          status: "active",
          subscriptionId: "active-pro",
        });
        const access = await resolveAccess(ctx, userId);
        expect(await resolveAccess(ctx, userId)).toEqual(access);
        const advisory = await runConvexProgram(
          getTryoutStartAccess(ctx, {
            countryKey: "indonesia",
            examKey: "snbt",
            now: NOW,
            setKey: "set-1",
            trackKey: "2027",
            userId,
          })
        );
        return {
          access,
          advisory,
          entitlements: await ctx.db.query("tryoutEntitlements").collect(),
        };
      });
      expect(result.access).toEqual({
        accessEndsAt:
          currentPeriodEnd === null ? Number.MAX_SAFE_INTEGER : PERIOD_END,
        accessSourceKind: "subscription",
        accessSubscriptionId: "active-pro",
        countsForCompetition: false,
      });
      expect(result.advisory).toEqual({ kind: "included" });
      expect(result.entitlements).toEqual([]);
    }
  );

  it("finds a live subscription after more than ten expired records", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      for (let index = 0; index < 32; index += 1) {
        await insertSubscription(ctx, {
          currentPeriodEnd: new Date(NOW - index).toISOString(),
          status: "active",
          subscriptionId: `expired-${index}`,
        });
      }
      await insertSubscription(ctx, {
        status: "active",
        subscriptionId: "live",
      });
      return resolveAccess(ctx, userId);
    });
    expect(result).toMatchObject({
      accessEndsAt: PERIOD_END,
      accessSubscriptionId: "live",
    });
  });

  it.each([
    { status: "canceled" },
    { status: "active", currentPeriodEnd: new Date(NOW).toISOString() },
    { status: "active", currentPeriodEnd: "not-a-date" },
    { status: "active", productId: "another-product" },
  ])(
    "ignores a stale cached entitlement when the authoritative subscription is %o",
    async (subscription) => {
      const t = convexTest(schema, convexModules);
      const result = await t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        await insertCustomer(ctx, userId);
        await insertSubscription(ctx, {
          ...subscription,
          subscriptionId: "stale-pro",
        });
        await ctx.db.insert("tryoutEntitlements", {
          countryKey: "indonesia",
          examKey: "snbt",
          startsAt: NOW,
          endsAt: PERIOD_END,
          sourceKind: "subscription",
          subscriptionId: "stale-pro",
          userId,
        });
        return resolveAccess(ctx, userId);
      });
      expect(result).toBeNull();
    }
  );

  it("keeps free participation available without a Polar customer", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) =>
      resolveAccess(ctx, await insertUser(ctx))
    );
    expect(result).toBeNull();
  });

  it("preserves a typed database failure instead of granting access", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(insertUser);
    const failure = await t.query((ctx) => {
      vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
        throw new Error("Subscription store unavailable");
      });
      return runConvexProgram(
        getIncludedAttemptAccess(ctx, {
          countryKey: "indonesia",
          examKey: "snbt",
          now: NOW,
          setKey: "set-1",
          trackKey: "2027",
          userId,
        }).pipe(
          Effect.match({
            onFailure: (error) => {
              expect(error).toBeInstanceOf(TryoutStartError);
              return error.code;
            },
            onSuccess: () => null,
          })
        )
      );
    });
    expect(failure).toBe("TRYOUT_START_FAILED");
  });
});
