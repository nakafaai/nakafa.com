import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import { getIncludedAttemptAccess } from "@repo/backend/confect/tryouts/access/impl";
import { TryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  insertPolarAccount,
  insertProSubscription,
  PRO_PERIOD_END,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest } from "convex-test";
import { DateTime, Effect } from "effect";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);

/** Inserts one user row for try-out access tests. */
async function insertUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    authId: "auth-tryout-access",
    credits: 10,
    creditsResetAt: NOW,
    email: "tryout-access@example.com",
    mascot: MASCOT_CODE,
    name: "Tryout Access",
    plan: "pro",
  });
}

/** Resolves included access for one test scope through the Effect boundary. */
function resolveAccess(ctx: MutationCtx, userId: Id<"users">) {
  return getIncludedAttemptAccess({
    countryKey: "indonesia",
    examKey: "snbt",
    now: NOW,
    setKey: "set-1",
    trackKey: "2027",
    userId,
  }).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}

describe("tryouts/access/impl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([null, PRO_PERIOD_END])(
    "reads current subscription attribution consistently: %s",
    async (currentPeriodEnd) => {
      const t = convexTest(schema, convexModules);
      const result = await t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        const accountId = await insertPolarAccount(ctx, userId, "polar-access");
        const subscriptionId = await insertProSubscription(ctx, accountId, {
          currentPeriodEnd,
        });
        const access = await Effect.runPromise(resolveAccess(ctx, userId));
        expect(await Effect.runPromise(resolveAccess(ctx, userId))).toEqual(
          access
        );
        return { access, subscriptionId };
      });
      expect(result.access).toEqual({
        accessEndsAt:
          currentPeriodEnd === null ? Number.MAX_SAFE_INTEGER : PRO_PERIOD_END,
        accessSourceKind: "subscription",
        accessSubscriptionId: result.subscriptionId,
        countsForCompetition: false,
      });
    }
  );

  it("finds the live subscription behind an expired one on the same account", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      const accountId = await insertPolarAccount(ctx, userId, "polar-access");
      await insertProSubscription(ctx, accountId, {
        currentPeriodEnd: DateTime.toEpochMillis(
          DateTime.makeUnsafe(NOW - 1000)
        ),
        subscriptionId: "expired-pro",
      });
      const liveId = await insertProSubscription(ctx, accountId, {
        subscriptionId: "live-pro",
      });
      return {
        access: await Effect.runPromise(resolveAccess(ctx, userId)),
        liveId,
      };
    });
    expect(result.access).toMatchObject({
      accessEndsAt: PRO_PERIOD_END,
      accessSubscriptionId: result.liveId,
    });
  });

  it.each([{ status: "canceled" as const }, { currentPeriodEnd: NOW }])(
    "rejects ineligible subscription state: %o",
    async (overrides) => {
      const t = convexTest(schema, convexModules);
      const result = await t.mutation(async (ctx) => {
        const userId = await insertUser(ctx);
        const accountId = await insertPolarAccount(ctx, userId, "polar-access");
        await insertProSubscription(ctx, accountId, {
          subscriptionId: "stale-pro",
          ...overrides,
        });
        return Effect.runPromise(resolveAccess(ctx, userId));
      });
      expect(result).toBeNull();
    }
  );

  it("keeps free participation available without a billing account", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) =>
      Effect.runPromise(resolveAccess(ctx, await insertUser(ctx)))
    );
    expect(result).toBeNull();
  });

  it("reads the xendit account when the Polar account holds no subscription", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx);
      await insertPolarAccount(ctx, userId, null);
      const xenditAccountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const subscriptionId = await insertProSubscription(ctx, xenditAccountId, {
        subscriptionId: "xendit-pro",
      });
      return {
        access: await Effect.runPromise(resolveAccess(ctx, userId)),
        subscriptionId,
      };
    });
    expect(result.access).toMatchObject({
      accessSubscriptionId: result.subscriptionId,
    });
  });

  it.each([1, 2])(
    "preserves a typed failure from subscription read %i instead of granting access",
    async (failedRead) => {
      const t = convexTest(schema, convexModules);
      const userId = await t.mutation(async (ctx) => {
        const id = await insertUser(ctx);
        const accountId = await insertPolarAccount(ctx, id, "polar-access");
        await insertProSubscription(ctx, accountId);
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
