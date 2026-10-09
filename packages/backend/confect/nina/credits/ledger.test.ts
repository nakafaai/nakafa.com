import { RegisteredConvexFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { ModelId, type ModelKey } from "@repo/backend/confect/gateway/model";
import {
  refundCredits,
  reserveCredits,
} from "@repo/backend/confect/nina/credits/ledger";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { products } from "@repo/backend/confect/utils/polar/products";
import { internal } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Effect, Option } from "effect";

const NOW = Date.UTC(2026, 8, 1);
async function fixture(credits = 2, creditsResetAt = NOW) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits, creditsResetAt })
  );
  const reserve = (model: ModelKey = "nakafa-lite") =>
    t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", identity.userId);
      assert(user);
      return Effect.runPromise(
        reserveCredits(user, ModelId.make(model)).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      );
    });
  return { t, identity, reserve };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Nina credit transactions", () => {
  it("materializes a due daily grant before the Agent turn debit", async () => {
    const { t, identity, reserve } = await fixture(0, NOW - 86_400_000);
    const hold = await reserve();
    await t.mutation((ctx) =>
      Effect.runPromise(
        refundCredits(hold, "settled-turn").pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    const result = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(result.user?.credits).toBe(10);
    expect(
      Arr.map(result.ledger, ({ type, amount }) => [type, amount])
    ).toEqual([
      ["daily-grant", 10],
      ["usage", -2],
      ["refund", 2],
    ]);
  });

  it.each([
    ["nakafa-lite", 2],
    ["nakafa-pro", 5],
  ] as const)(
    "holds the %s response price of %i credits and refuses less",
    async (model, price) => {
      const priced = await fixture(price);
      const hold = await priced.reserve(model);
      const user = await priced.t.query((ctx) =>
        ctx.db.get("users", priced.identity.userId)
      );
      expect(hold).toMatchObject({ credits: price, modelId: model });
      expect(user?.credits).toBe(0);
      await expect(
        (await fixture(price - 1)).reserve(model)
      ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    }
  );

  it.each(["ledger", "state", "quota"] as const)(
    "rolls back admission and returns a typed %s failure",
    async (operation) => {
      const { t, identity } = await fixture();
      await expect(
        t.mutation(async (ctx) => {
          const user = await ctx.db.get("users", identity.userId);
          assert(user);
          if (operation === "ledger") {
            vi.spyOn(ctx.db, "replace").mockRejectedValueOnce(
              new Error("private ledger detail")
            );
          }
          if (operation === "state") {
            vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
              throw new Error("private state detail");
            });
          }
          if (operation === "quota") {
            vi.spyOn(ctx, "runMutation").mockRejectedValueOnce(
              new Error("private quota detail")
            );
          }
          return Effect.runPromise(
            reserveCredits(user, ModelId.make("nakafa-lite")).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(schema, ctx)
              )
            )
          );
        })
      ).rejects.toMatchObject({ code: "NINA_CREDIT_IO_FAILED" });
      const result = await t.query(async (ctx) => ({
        user: await ctx.db.get("users", identity.userId),
        ledger: await ctx.db.query("creditTransactions").collect(),
      }));
      expect(result.user?.credits).toBe(2);
      expect(result.ledger).toEqual([]);
    }
  );

  it.each(["user", "state"] as const)(
    "rolls back a refund when its %s cannot be read",
    async (operation) => {
      const { t, identity, reserve } = await fixture();
      const hold = await reserve();
      await expect(
        t.mutation((ctx) => {
          if (operation === "user") {
            vi.spyOn(ctx.db, "get").mockRejectedValueOnce(
              new Error("private user detail")
            );
          }
          if (operation === "state") {
            vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
              throw new Error("private state detail");
            });
          }
          return Effect.runPromise(
            refundCredits(hold, "failed-turn").pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(schema, ctx)
              )
            )
          );
        })
      ).rejects.toMatchObject({ code: "NINA_CREDIT_IO_FAILED" });
      const result = await t.query(async (ctx) => ({
        user: await ctx.db.get("users", identity.userId),
        ledger: await ctx.db.query("creditTransactions").collect(),
      }));
      expect(result.user?.credits).toBe(0);
      expect(result.ledger).toHaveLength(1);
    }
  );

  it.each([false, true])(
    "does not refund into a replacement plan grant (resubscribe %s)",
    async (resubscribe) => {
      const { t, identity, reserve } = await fixture();
      await t.mutation((ctx) =>
        ctx.db.insert("customers", {
          id: "grant-customer",
          userId: identity.userId,
          externalId: null,
          metadata: {},
        })
      );
      const subscription = {
        id: "grant-subscription",
        customerId: "grant-customer",
        createdAt: new Date(NOW).toISOString(),
        modifiedAt: null,
        amount: null,
        currency: null,
        recurringInterval: null,
        status: "active",
        currentPeriodStart: new Date(NOW).toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        startedAt: new Date(NOW).toISOString(),
        endedAt: null,
        productId: products.pro.id,
        checkoutId: null,
        metadata: {},
      };
      await t.mutation(internal.subscriptions.mutations.createSubscription, {
        subscription,
      });
      const hold = await reserve();
      await t.mutation(internal.subscriptions.mutations.updateSubscription, {
        subscription: { ...subscription, status: "canceled" },
      });
      if (resubscribe) {
        await t.mutation(internal.subscriptions.mutations.updateSubscription, {
          subscription,
        });
      }
      await t.mutation((ctx) =>
        Effect.runPromise(
          refundCredits(hold, "old-grant-turn").pipe(
            Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
          )
        )
      );
      const result = await t.query(async (ctx) => ({
        user: await ctx.db.get("users", identity.userId),
        ledger: await ctx.db.query("creditTransactions").collect(),
      }));
      expect(result.user?.credits).toBe(resubscribe ? 3000 : 10);
      expect(result.user?.planCreditGrantId).not.toBe(hold.planCreditGrantId);
      expect(Option.getOrThrow(Arr.last(result.ledger))).toMatchObject({
        type: "refund",
        amount: 0,
      });
    }
  );
});
