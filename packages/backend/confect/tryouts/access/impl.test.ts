import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import {
  getIncludedAttemptAccess,
  getTryoutStartAccess,
} from "@repo/backend/confect/tryouts/access/impl";
import { TryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { products } from "@repo/backend/confect/utils/polar/products";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { DateTime, Effect } from "effect";

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
  const timestamp = DateTime.formatIso(DateTime.makeUnsafe(NOW));
  let currentPeriodEnd: string | null = DateTime.formatIso(
    DateTime.makeUnsafe(PERIOD_END)
  );
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
  args: {
    setKey?: string;
    trackKey?: string;
  } = {}
) {
  return getIncludedAttemptAccess({
    countryKey: "indonesia",
    examKey: "snbt",
    now: NOW,
    setKey: args.setKey ?? "set-1",
    trackKey: args.trackKey ?? "2027",
    userId,
  }).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}
describe("tryouts/access/impl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each([null, DateTime.formatIso(DateTime.makeUnsafe(PERIOD_END))])(
    "reads current subscription attribution consistently: %s",
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
        const access = await Effect.runPromise(resolveAccess(ctx, userId));
        expect(await Effect.runPromise(resolveAccess(ctx, userId))).toEqual(
          access
        );
        const advisory = await Effect.runPromise(
          getTryoutStartAccess({
            countryKey: "indonesia",
            examKey: "snbt",
            now: NOW,
            setKey: "set-1",
            trackKey: "2027",
            userId,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        return {
          access,
          advisory,
        };
      });
      expect(result.access).toEqual({
        accessEndsAt:
          currentPeriodEnd === null ? Number.MAX_SAFE_INTEGER : PERIOD_END,
        accessSourceKind: "subscription",
        accessSubscriptionId: "active-pro",
        countsForCompetition: false,
      });
      expect(result.advisory).toEqual({
        kind: "included",
      });
    }
  );
  it("finds a live subscription after more than ten expired records", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      for (let index = 0; index < 32; index += 1) {
        await insertSubscription(ctx, {
          currentPeriodEnd: DateTime.formatIso(
            DateTime.makeUnsafe(NOW - index)
          ),
          status: "active",
          subscriptionId: `expired-${index}`,
        });
      }
      await insertSubscription(ctx, {
        status: "active",
        subscriptionId: "live",
      });
      return Effect.runPromise(resolveAccess(ctx, userId));
    });
    expect(result).toMatchObject({
      accessEndsAt: PERIOD_END,
      accessSubscriptionId: "live",
    });
  });
  it.each([
    {
      status: "canceled",
    },
    {
      status: "active",
      currentPeriodEnd: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
    },
    {
      status: "active",
      currentPeriodEnd: "not-a-date",
    },
    {
      status: "active",
      productId: "another-product",
    },
  ])("rejects ineligible subscription state: %o", async (subscription) => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertCustomer(ctx, userId);
      await insertSubscription(ctx, {
        ...subscription,
        subscriptionId: "stale-pro",
      });
      return Effect.runPromise(resolveAccess(ctx, userId));
    });
    expect(result).toBeNull();
  });
  it("keeps free participation available without a Polar customer", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) =>
      Effect.runPromise(resolveAccess(ctx, await insertUser(ctx)))
    );
    expect(result).toBeNull();
  });
  it.each([1, 2, 3])(
    "preserves a typed failure from subscription read %i instead of granting access",
    async (failedRead) => {
      const t = convexTest(schema, convexModules);
      const userId = await t.mutation(async (ctx) => {
        const id = await insertUser(ctx);
        await insertCustomer(ctx, id);
        return id;
      });
      const failure = await t.query((ctx) => {
        const query = ctx.db.query.bind(ctx.db);
        let reads = 0;
        vi.spyOn(ctx.db, "query").mockImplementation((table) => {
          reads += 1;
          if (reads === failedRead) {
            throw new Error("Subscription store unavailable");
          }
          return query(table);
        });
        return Effect.runPromise(
          getIncludedAttemptAccess({
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
            }),
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        );
      });
      expect(failure).toBe("TRYOUT_START_FAILED");
    }
  );
});
