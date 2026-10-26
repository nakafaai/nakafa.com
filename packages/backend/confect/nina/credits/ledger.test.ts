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
import { projectUserPlan } from "@repo/backend/confect/billing/grants";
import {
  refundCredits,
  reserveCredits,
} from "@repo/backend/confect/nina/credits/ledger";
import type { NinaCreditHold } from "@repo/backend/confect/nina/credits/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { insertTopUpPack, runInMutation } from "@repo/backend/test/billing";
import { Array as Arr, Effect, Option, Schema } from "effect";

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
      const grant = {
        product: "pro" as const,
        userId: identity.userId,
        source: { kind: "contract" as const, contractId: "grant-contract" },
        validFrom: NOW,
        validTo: NOW + 30 * 86_400_000,
      };
      const project = () =>
        t.mutation((ctx) =>
          Effect.runPromise(
            projectUserPlan(identity.userId, NOW).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(schema, ctx)
              )
            )
          )
        );
      await t.mutation((ctx) => ctx.db.insert("billingGrants", grant));
      await project();
      const hold = await reserve();
      await t.mutation(async (ctx) => {
        const found = await ctx.db
          .query("billingGrants")
          .withIndex("by_userId_and_validTo", (query) =>
            query.eq("userId", identity.userId)
          )
          .unique();
        assert(found);
        await ctx.db.delete(found._id);
      });
      await project();
      if (resubscribe) {
        await t.mutation((ctx) =>
          ctx.db.insert("billingGrants", {
            ...grant,
            source: { kind: "contract", contractId: "grant-contract-renewed" },
          })
        );
        await project();
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

const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

/** Adds one top-up pack to a learner, bought by its own payment. */
const addPack = (
  t: Awaited<ReturnType<typeof fixture>>["t"],
  userId: Id<"users">,
  pack: Parameters<typeof insertTopUpPack>[2]
) => t.mutation((ctx) => insertTopUpPack(ctx, userId, pack));

describe("Nina credit packs", () => {
  it("spends the allowance first, then the packs soonest expiring first, and names each source in the hold", async () => {
    const { t, identity, reserve } = await fixture(5);
    const soon = await addPack(t, identity.userId, {
      expiresAt: NOW + ONE_MONTH,
      providerPaymentId: "order_soon",
      remaining: 30,
    });
    const late = await addPack(t, identity.userId, {
      expiresAt: NOW + 2 * ONE_MONTH,
      providerPaymentId: "order_late",
      remaining: 40,
    });
    const hold = await reserve();
    expect(hold).toMatchObject({
      credits: 50,
      lots: [
        { lotId: soon, credits: 30 },
        { lotId: late, credits: 15 },
      ],
    });
    const after = await t.query(async (ctx) => ({
      lateLot: await ctx.db.get(late),
      ledger: await ctx.db.query("creditTransactions").collect(),
      soonLot: await ctx.db.get(soon),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(after.user?.credits).toBe(0);
    expect(after.soonLot).toMatchObject({ remaining: 0, state: "active" });
    expect(after.lateLot).toMatchObject({ remaining: 25, state: "active" });
    expect(
      Arr.map(after.ledger, ({ amount, balanceAfter, metadata, type }) => [
        type,
        amount,
        balanceAfter,
        metadata,
      ])
    ).toEqual([
      ["usage", -5, 0, { phase: "reserved" }],
      ["usage", -30, 0, { phase: "reserved", lotId: soon }],
      ["usage", -15, 25, { phase: "reserved", lotId: late }],
    ]);
    expect(hold.transactionId).toBe(after.ledger[0]?._id);
  });

  it("takes the whole hold from packs when the allowance is empty, and names the first pack's usage as the hold's transaction", async () => {
    const { t, identity, reserve } = await fixture(0);
    const pack = await addPack(t, identity.userId, {
      expiresAt: NOW + ONE_MONTH,
      providerPaymentId: "order_only",
      remaining: 10,
    });
    const hold = await reserve();
    const ledger = await t.query((ctx) =>
      ctx.db.query("creditTransactions").collect()
    );
    expect(hold).toMatchObject({
      credits: 10,
      lots: [{ lotId: pack, credits: 10 }],
    });
    expect(hold.transactionId).toBe(ledger[0]?._id);
  });

  it("refunds the packs first, the last drawn first, and returns nothing to the allowance while the packs take all of it", async () => {
    const { t, identity, reserve } = await fixture(5);
    const soon = await addPack(t, identity.userId, {
      expiresAt: NOW + ONE_MONTH,
      providerPaymentId: "order_refund_soon",
      remaining: 30,
    });
    const late = await addPack(t, identity.userId, {
      expiresAt: NOW + 2 * ONE_MONTH,
      providerPaymentId: "order_refund_late",
      remaining: 40,
    });
    const hold = await reserve();
    await refundHold(t, hold, "turn_refund", 45);
    const after = await t.query(async (ctx) => ({
      late: await ctx.db.get(late),
      soon: await ctx.db.get(soon),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(after.late).toMatchObject({ remaining: 40 });
    expect(after.soon).toMatchObject({ remaining: 30 });
    expect(after.user?.credits).toBe(0);
  });

  it("returns the rest of a refund to the allowance once the packs have their share back", async () => {
    const { t, identity, reserve } = await fixture(5);
    await addPack(t, identity.userId, {
      expiresAt: NOW + ONE_MONTH,
      providerPaymentId: "order_allowance_soon",
      remaining: 30,
    });
    await addPack(t, identity.userId, {
      expiresAt: NOW + 2 * ONE_MONTH,
      providerPaymentId: "order_allowance_late",
      remaining: 40,
    });
    const hold = await reserve();
    await refundHold(t, hold, "turn_allowance", 50);
    const after = await t.query(async (ctx) => ({
      ledger: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(after.user?.credits).toBe(5);
    expect(Option.getOrUndefined(Arr.last(after.ledger))).toMatchObject({
      amount: 5,
      type: "refund",
    });
  });

  it("loses the share of a pack that ended during the turn, and keeps the rest for the packs that run", async () => {
    const { t, identity, reserve } = await fixture(0);
    const ended = await addPack(t, identity.userId, {
      expiresAt: NOW + ONE_MONTH,
      providerPaymentId: "order_ended_turn",
      remaining: 20,
    });
    const running = await addPack(t, identity.userId, {
      expiresAt: NOW + 2 * ONE_MONTH,
      providerPaymentId: "order_running_turn",
      remaining: 30,
    });
    const hold = await reserve();
    await t.mutation((ctx) =>
      ctx.db.patch("creditLots", ended, { remaining: 0, state: "expired" })
    );
    await refundHold(t, hold, "turn_ended", 50);
    const after = await t.query(async (ctx) => ({
      ended: await ctx.db.get(ended),
      running: await ctx.db.get(running),
      user: await ctx.db.get("users", identity.userId),
    }));
    expect(after.ended).toMatchObject({ remaining: 0, state: "expired" });
    expect(after.running).toMatchObject({ remaining: 30 });
    expect(after.user?.credits).toBe(0);
  });

  it("refunds a turn reserved before packs existed entirely to the allowance", async () => {
    const { t, identity, reserve } = await fixture(5);
    const hold = await reserve();
    const { lots: _lots, ...legacyHold } = hold;
    await refundHold(t, legacyHold, "turn_legacy", 4);
    const user = await t.query((ctx) => ctx.db.get("users", identity.userId));
    expect(user?.credits).toBe(4);
  });
});

/** Refunds part of one hold inside a test mutation, as settlement does. */
async function refundHold(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  hold: typeof NinaCreditHold.Type,
  reservationId: string,
  amount: number
) {
  await t.mutation((ctx) =>
    runInMutation(ctx, refundCredits(hold, reservationId, amount))
  );
}
