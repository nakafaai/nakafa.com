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
import usersTable from "@repo/backend/confect/_generated/tables/users";
import { products } from "@repo/backend/confect/billing/polar/products";
import {
  refundCredits,
  reserveCredits,
} from "@repo/backend/confect/nina/credits/ledger";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { Array as Arr, DateTime, Effect, Option, Schema } from "effect";

const NOW = Date.UTC(2026, 8, 1);
/** Reads a raw account the way Confect reads it, so its animal is decoded. */
const decodeUser = Schema.decodeUnknownSync(usersTable.Doc);
async function fixture(credits = 5, creditsResetAt = NOW) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits, creditsResetAt })
  );
  const reserve = () =>
    t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", identity.userId);
      assert(user);
      return Effect.runPromise(
        reserveCredits(decodeUser(user)).pipe(
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
        refundCredits(hold, "settled-turn", 4).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    const result = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(result.user?.credits).toBe(4);
    expect(
      Arr.map(result.ledger, ({ type, amount }) => [type, amount])
    ).toEqual([
      ["daily-grant", 10],
      ["usage", -10],
      ["refund", 4],
    ]);
  });

  it("holds up to fifty credits for one response, the whole balance when less, and refuses an empty balance", async () => {
    const priced = await fixture(5);
    const hold = await priced.reserve();
    const state = await priced.t.query(async (ctx) => ({
      user: await ctx.db.get("users", priced.identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(hold).toMatchObject({ credits: 5 });
    expect(state.user?.credits).toBe(0);
    expect(Arr.map(state.ledger, (row) => row.metadata)).toEqual([
      { phase: "reserved" },
    ]);
    const capped = await fixture(80);
    expect(await capped.reserve()).toMatchObject({ credits: 50 });
    const cappedUser = await capped.t.query((ctx) =>
      ctx.db.get("users", capped.identity.userId)
    );
    expect(cappedUser?.credits).toBe(30);
    await expect((await fixture(0)).reserve()).rejects.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
    });
  });

  it("gives nothing back when an answer's cost holds the whole reservation", async () => {
    const { t, identity, reserve } = await fixture(5);
    const hold = await reserve();
    await t.mutation((ctx) =>
      Effect.runPromise(
        refundCredits(hold, "answered-turn", 0).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    const result = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(result.user?.credits).toBe(0);
    expect(result.ledger).toHaveLength(1);
  });

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
            reserveCredits(decodeUser(user)).pipe(
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
      expect(result.user?.credits).toBe(5);
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
            refundCredits(hold, "failed-turn", hold.credits).pipe(
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

  it("refuses the sixth start within a minute", async () => {
    const { reserve } = await fixture(1000);
    for (let start = 0; start < 5; start += 1) {
      await reserve();
    }
    await expect(reserve()).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("gives nothing back when the turn's user is gone", async () => {
    const { t, identity, reserve } = await fixture(5);
    const hold = await reserve();
    await t.mutation((ctx) => ctx.db.delete("users", identity.userId));
    await t.mutation((ctx) =>
      Effect.runPromise(
        refundCredits(hold, "gone-turn", hold.credits).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      )
    );
    const ledger = await t.query((ctx) =>
      ctx.db.query("creditTransactions").collect()
    );
    expect(ledger).toHaveLength(1);
  });

  it("does not return a hold from an earlier credit period into the next one", async () => {
    const { t, identity, reserve } = await fixture(0, NOW - 86_400_000);
    const hold = await reserve();
    vi.setSystemTime(NOW + 86_400_000);
    await t.mutation((ctx) =>
      Effect.runPromise(
        refundCredits(hold, "late-turn", hold.credits).pipe(
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
      ["usage", -10],
      ["daily-grant", 10],
      ["refund", 0],
    ]);
  });

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
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
        modifiedAt: null,
        amount: null,
        currency: null,
        recurringInterval: null,
        status: "active",
        currentPeriodStart: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        startedAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
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
          refundCredits(hold, "old-grant-turn", hold.credits).pipe(
            Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
          )
        )
      );
      const result = await t.query(async (ctx) => ({
        user: await ctx.db.get("users", identity.userId),
        ledger: await ctx.db.query("creditTransactions").collect(),
      }));
      expect(result.user?.credits).toBe(resubscribe ? 1000 : 10);
      expect(result.user?.planCreditGrantId).not.toBe(hold.planCreditGrantId);
      expect(Option.getOrThrow(Arr.last(result.ledger))).toMatchObject({
        type: "refund",
        amount: 0,
      });
    }
  );
});
