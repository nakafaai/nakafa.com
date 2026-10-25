import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  debitLot,
  drawLots,
  expireLot,
  forfeitLots,
  grantTopUpLot,
  readSpendableLots,
  refundLotOfPayment,
  restoreLot,
} from "@repo/backend/confect/credits/lots";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  insertTopUpPack,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Effect, Option } from "effect";

const NOW = Date.UTC(2026, 9, 25, 12);
const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

type Learner = Awaited<ReturnType<typeof seedLearner>>;

/** One learner with a Polar account, the owner every pack and payment names. */
async function seedLearner(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-lots",
    credits: 0,
    creditsResetAt: NOW,
    email: "lots@example.com",
    mascot: MASCOT_CODE,
    name: "Lots",
    plan: "pro",
  });
  const accountId = await insertPolarAccount(ctx, userId);
  return { accountId, userId };
}

/** One pack of a learner, bought by its own top-up payment, holding the given credits. */
const seedPack = (
  ctx: MutationCtx,
  learner: Learner,
  pack: Parameters<typeof insertTopUpPack>[2]
) => insertTopUpPack(ctx, learner.userId, pack);

/** The ledger rows of one learner: type, amount, the balance after, and the metadata. */
async function ledgerOf(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("creditTransactions")
    .withIndex("by_userId", (query) => query.eq("userId", userId))
    .collect();
  return Arr.map(rows, ({ amount, balanceAfter, metadata, type }) => ({
    amount,
    balanceAfter,
    metadata,
    type,
  }));
}

/** The pack's stored row, read back after a write. */
async function lotOf(ctx: MutationCtx, lotId: Id<"creditLots">) {
  const lot = await ctx.db.get(lotId);
  if (lot === null) {
    throw new Error(`Lot ${lotId} is missing.`);
  }
  return { remaining: lot.remaining, state: lot.state };
}

describe("credits/lots", () => {
  it("lists only packs that run and hold credits, soonest expiry first, and draws in that order", async () => {
    const t = createBillingTestConvex();
    const seeded = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const late = await seedPack(ctx, learner, {
        expiresAt: NOW + 2 * ONE_MONTH,
        providerPaymentId: "order_late",
        remaining: 300,
      });
      const soon = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_soon",
        remaining: 200,
      });
      await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_spent",
        remaining: 0,
      });
      await seedPack(ctx, learner, {
        expiresAt: NOW,
        providerPaymentId: "order_due",
        remaining: 90,
      });
      await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_forfeited",
        remaining: 80,
        state: "forfeited",
      });
      return { late, learner, soon };
    });
    const draws = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.gen(function* () {
          const lots = yield* readSpendableLots(seeded.learner.userId, NOW);
          return Arr.map(drawLots(lots, 350), (draw) => [
            draw.lot._id,
            draw.credits,
          ]);
        })
      )
    );
    expect(draws).toEqual([
      [seeded.soon, 200],
      [seeded.late, 150],
    ]);
  });

  it("restores a draw to a pack that still runs, and keeps nothing for a pack that ended or is gone", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const running = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_running",
        remaining: 100,
      });
      const ended = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_ended",
        remaining: 0,
        state: "expired",
      });
      const dueNow = await seedPack(ctx, learner, {
        expiresAt: NOW,
        providerPaymentId: "order_due",
        remaining: 10,
      });
      const gone = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_gone",
        remaining: 0,
      });
      await ctx.db.delete(gone);
      return { dueNow, ended, gone, learner, running };
    });
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.all(
          [
            restoreLot({ lotId: ids.running, credits: 40 }, "turn_1", NOW),
            restoreLot({ lotId: ids.ended, credits: 5 }, "turn_1", NOW),
            restoreLot({ lotId: ids.dueNow, credits: 5 }, "turn_1", NOW),
            restoreLot({ lotId: ids.gone, credits: 5 }, "turn_1", NOW),
          ],
          { discard: true }
        )
      )
    );
    const after = await t.run(async (ctx) => ({
      ledger: await ledgerOf(ctx, ids.learner.userId),
      running: await lotOf(ctx, ids.running),
    }));
    expect(after.running).toEqual({ remaining: 140, state: "active" });
    expect(after.ledger).toEqual([
      {
        amount: 40,
        balanceAfter: 140,
        metadata: { lotId: ids.running, reservationId: "turn_1" },
        type: "refund",
      },
    ]);
  });

  it("spends a pack's credits as a usage row that names the pack", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const lotId = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_debit",
        remaining: 60,
      });
      return { learner, lotId };
    });
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.gen(function* () {
          const [lot] = yield* readSpendableLots(ids.learner.userId, NOW);
          if (lot === undefined) {
            return yield* Effect.die("the pack should be spendable");
          }
          return yield* debitLot(lot, 25, { phase: "reserved" });
        })
      )
    );
    const after = await t.run(async (ctx) => ({
      ledger: await ledgerOf(ctx, ids.learner.userId),
      lot: await lotOf(ctx, ids.lotId),
    }));
    expect(after.lot).toEqual({ remaining: 35, state: "active" });
    expect(after.ledger).toEqual([
      {
        amount: -25,
        balanceAfter: 35,
        metadata: { lotId: ids.lotId, phase: "reserved" },
        type: "usage",
      },
    ]);
  });

  it("expires a pack at its expiry, writes its unused credits once, and ignores a pack not yet due", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const dueLot = await seedPack(ctx, learner, {
        expiresAt: NOW,
        providerPaymentId: "order_expiring",
        remaining: 120,
      });
      const laterLot = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_later",
        remaining: 50,
      });
      const spentLot = await seedPack(ctx, learner, {
        expiresAt: NOW,
        providerPaymentId: "order_spent_due",
        remaining: 0,
      });
      return { dueLot, laterLot, learner, spentLot };
    });
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.gen(function* () {
          yield* expireLot(ids.laterLot, NOW);
          yield* expireLot(ids.dueLot, NOW);
          yield* expireLot(ids.dueLot, NOW);
          yield* expireLot(ids.spentLot, NOW);
        })
      )
    );
    const after = await t.run(async (ctx) => ({
      due: await lotOf(ctx, ids.dueLot),
      ledger: await ledgerOf(ctx, ids.learner.userId),
      later: await lotOf(ctx, ids.laterLot),
      spent: await lotOf(ctx, ids.spentLot),
    }));
    expect(after.later).toEqual({ remaining: 50, state: "active" });
    expect(after.due).toEqual({ remaining: 0, state: "expired" });
    expect(after.spent).toEqual({ remaining: 0, state: "expired" });
    expect(after.ledger).toEqual([
      {
        amount: -120,
        balanceAfter: 0,
        metadata: { lotId: ids.dueLot, reason: "expired" },
        type: "expiration",
      },
    ]);
  });

  it("forfeits every running pack when Pro ends, and leaves ended packs as they are", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const withCredits = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_kept",
        remaining: 50,
      });
      const spent = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_spent_running",
        remaining: 0,
      });
      const refunded = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_refunded",
        remaining: 0,
        state: "refunded",
      });
      return { learner, refunded, spent, withCredits };
    });
    await t.mutation((ctx) =>
      runInMutation(ctx, forfeitLots(ids.learner.userId))
    );
    const after = await t.run(async (ctx) => ({
      ledger: await ledgerOf(ctx, ids.learner.userId),
      refunded: await lotOf(ctx, ids.refunded),
      spent: await lotOf(ctx, ids.spent),
      withCredits: await lotOf(ctx, ids.withCredits),
    }));
    expect(after.withCredits).toEqual({ remaining: 0, state: "forfeited" });
    expect(after.spent).toEqual({ remaining: 0, state: "forfeited" });
    expect(after.refunded).toEqual({ remaining: 0, state: "refunded" });
    expect(after.ledger).toEqual([
      {
        amount: -50,
        balanceAfter: 0,
        metadata: { lotId: ids.withCredits, reason: "pro-ended" },
        type: "expiration",
      },
    ]);
  });

  it("removes the unused credits of a refunded payment's pack, once, and keeps the credits already spent", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const lotId = await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_to_refund",
        remaining: 700,
      });
      const paymentId = (await ctx.db.get(lotId))?.paymentId;
      return { learner, lotId, paymentId };
    });
    if (ids.paymentId === undefined) {
      throw new Error("The seeded pack names no payment.");
    }
    const paymentId = ids.paymentId;
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.all(
          [refundLotOfPayment(paymentId), refundLotOfPayment(paymentId)],
          { discard: true }
        )
      )
    );
    await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      await seedPack(ctx, learner, {
        expiresAt: NOW + ONE_MONTH,
        providerPaymentId: "order_unrelated",
        remaining: 5,
      });
    });
    const after = await t.run(async (ctx) => ({
      ledger: await ledgerOf(ctx, ids.learner.userId),
      lot: await lotOf(ctx, ids.lotId),
    }));
    expect(after.lot).toEqual({ remaining: 0, state: "refunded" });
    expect(after.ledger).toEqual([
      {
        amount: -700,
        balanceAfter: 0,
        metadata: { lotId: ids.lotId, reason: "order-refunded" },
        type: "refund",
      },
    ]);
  });

  it("grants a pack of 1,000 credits that expires twelve months after payment, and writes the expiry when it is reached", async () => {
    const t = createBillingTestConvex();
    const ids = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      const paymentId = await ctx.db.insert("billingPayments", {
        accountId: learner.accountId,
        amount: 499,
        currency: "USD",
        kind: "credits",
        method: "order",
        paidAt: NOW,
        providerPaymentId: "order_granted",
        providerUpdatedAt: NOW,
        rail: "polar",
        status: "succeeded",
      });
      return { learner, paymentId };
    });
    const lotId = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        grantTopUpLot({
          paidAt: NOW,
          paymentId: ids.paymentId,
          userId: ids.learner.userId,
        })
      )
    );
    const granted = await t.run(async (ctx) => ({
      expiresAt: (await ctx.db.get(lotId))?.expiresAt,
      lot: await lotOf(ctx, lotId),
      ledger: await ledgerOf(ctx, ids.learner.userId),
    }));
    expect(granted.lot).toEqual({ remaining: 1000, state: "active" });
    expect(granted.expiresAt).toBe(Date.UTC(2027, 9, 25, 12));
    expect(granted.ledger).toEqual([
      {
        amount: 1000,
        balanceAfter: 1000,
        metadata: { lotId, paymentId: ids.paymentId },
        type: "purchase",
      },
    ]);
    // The expiry runs once the clock reaches it, so the test moves the clock there first.
    vi.setSystemTime(Date.UTC(2027, 9, 25, 12));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const expired = await t.run(async (ctx) => ({
      ledger: await ledgerOf(ctx, ids.learner.userId),
      lot: await lotOf(ctx, lotId),
    }));
    expect(expired.lot).toEqual({ remaining: 0, state: "expired" });
    expect(Option.getOrUndefined(Arr.last(expired.ledger))).toEqual({
      amount: -1000,
      balanceAfter: 0,
      metadata: { lotId, reason: "expired" },
      type: "expiration",
    });
  });

  it("forfeits every running pack, however many a single read does not take", async () => {
    const t = createBillingTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const learner = await seedLearner(ctx);
      for (let index = 0; index < 101; index += 1) {
        await seedPack(ctx, learner, {
          expiresAt: NOW + ONE_MONTH,
          providerPaymentId: `order_bulk_${index}`,
          remaining: 1,
        });
      }
      return learner.userId;
    });
    await t.mutation((ctx) => runInMutation(ctx, forfeitLots(userId)));
    const lots = await t.run((ctx) => ctx.db.query("creditLots").collect());
    expect(lots).toHaveLength(101);
    expect(
      Arr.every(lots, (lot) => lot.state === "forfeited" && lot.remaining === 0)
    ).toBe(true);
  });
});
