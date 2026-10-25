import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  applyTopUpPaid,
  applyTopUpRefunded,
  type TopUpOrder,
} from "@repo/backend/confect/billing/topup";
import {
  debitLot,
  readSpendableLots,
} from "@repo/backend/confect/credits/lots";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertPolarAccount,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 9, 25, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/** One learner with a Polar account, and a Pro grant when `pro` is true. */
async function seedLearner(ctx: MutationCtx, pro: boolean) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-topup-${pro}`,
    credits: 0,
    creditsResetAt: NOW,
    email: `topup-${pro}@example.com`,
    mascot: MASCOT_CODE,
    name: "Top-up",
    plan: pro ? "pro" : "free",
  });
  if (pro) {
    await ctx.db.insert("billingGrants", {
      product: "pro",
      source: { kind: "contract", contractId: "contract-topup" },
      userId,
      validFrom: NOW - ONE_DAY,
      validTo: NOW + ONE_DAY * 90,
    });
  }
  const accountId = await insertPolarAccount(ctx, userId);
  return { accountId, userId };
}

const ONE_DAY = 24 * 60 * 60 * 1000;

/** The order a Polar account pays for one top-up pack, in the test's fixed time. */
function orderOf(
  learner: {
    readonly accountId: Id<"billingAccounts">;
    readonly userId: Id<"users">;
  },
  providerPaymentId = "order_topup_1"
): TopUpOrder {
  return {
    accountId: learner.accountId,
    amount: 499,
    currency: "USD",
    providerPaymentId,
    providerUpdatedAt: NOW,
    rail: "polar",
    refundableAmount: 499,
    userId: learner.userId,
  };
}

/** The rows a top-up order leaves behind: its payments, its packs, and its ledger. */
function storedOf(
  t: ReturnType<typeof createBillingTestConvex>,
  userId: Id<"users">
) {
  return t.run(async (ctx) => ({
    lots: await ctx.db.query("creditLots").collect(),
    ledger: Arr.map(
      await ctx.db
        .query("creditTransactions")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .collect(),
      ({ amount, type }) => [type, amount]
    ),
    payments: Arr.map(
      await ctx.db.query("billingPayments").collect(),
      ({ kind, status }) => [kind, status]
    ),
  }));
}

describe("billing/topup", () => {
  it("grants one pack for the first delivery of a paid top-up order to a learner on Pro", async () => {
    const t = createBillingTestConvex();
    const learner = await t.mutation((ctx) => seedLearner(ctx, true));
    const first = await t.mutation((ctx) =>
      runInMutation(ctx, applyTopUpPaid(orderOf(learner)))
    );
    const again = await t.mutation((ctx) =>
      runInMutation(ctx, applyTopUpPaid(orderOf(learner)))
    );
    expect(first).toBe("applied");
    expect(again).toBe("duplicate");
    const stored = await storedOf(t, learner.userId);
    expect(stored.payments).toEqual([["credits", "succeeded"]]);
    expect(stored.lots).toHaveLength(1);
    expect(stored.lots[0]).toMatchObject({
      expiresAt: Date.UTC(2027, 9, 25, 12),
      remaining: 1000,
      state: "active",
    });
    expect(stored.ledger).toEqual([["purchase", 1000]]);
  });

  it("keeps the payment on record and grants no pack to a learner without Pro", async () => {
    const t = createBillingTestConvex();
    const learner = await t.mutation((ctx) => seedLearner(ctx, false));
    const outcome = await t.mutation((ctx) =>
      runInMutation(ctx, applyTopUpPaid(orderOf(learner)))
    );
    expect(outcome).toBe("withoutPro");
    const stored = await storedOf(t, learner.userId);
    expect(stored.payments).toEqual([["credits", "succeeded"]]);
    expect(stored.lots).toHaveLength(0);
    expect(stored.ledger).toEqual([]);
  });

  it("removes the unused credits of a refunded pack and keeps the credits already spent", async () => {
    const t = createBillingTestConvex();
    const learner = await t.mutation((ctx) => seedLearner(ctx, true));
    await t.mutation((ctx) =>
      runInMutation(ctx, applyTopUpPaid(orderOf(learner)))
    );
    await t.mutation((ctx) =>
      runInMutation(
        ctx,
        Effect.gen(function* () {
          const [lot] = yield* readSpendableLots(learner.userId, NOW);
          if (lot === undefined) {
            return yield* Effect.die("the pack should be spendable");
          }
          return yield* debitLot(lot, 300, { phase: "reserved" });
        })
      )
    );
    const refunded = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        applyTopUpRefunded({
          ...orderOf(learner),
          providerUpdatedAt: NOW + 1000,
        })
      )
    );
    const again = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        applyTopUpRefunded({
          ...orderOf(learner),
          providerUpdatedAt: NOW + 1000,
        })
      )
    );
    expect(refunded).toBe("applied");
    expect(again).toBe("duplicate");
    const stored = await storedOf(t, learner.userId);
    expect(stored.payments).toEqual([["credits", "refunded"]]);
    expect(stored.lots[0]).toMatchObject({ remaining: 0, state: "refunded" });
    expect(stored.ledger).toEqual([
      ["purchase", 1000],
      ["usage", -300],
      ["refund", -700],
    ]);
  });

  it("records a refund that arrives before its payment, and grants no pack when the payment follows", async () => {
    const t = createBillingTestConvex();
    const learner = await t.mutation((ctx) => seedLearner(ctx, true));
    const unseen = await t.mutation((ctx) =>
      runInMutation(
        ctx,
        applyTopUpRefunded({
          ...orderOf(learner),
          providerUpdatedAt: NOW + 1000,
        })
      )
    );
    const late = await t.mutation((ctx) =>
      runInMutation(ctx, applyTopUpPaid(orderOf(learner)))
    );
    expect(unseen).toBe("unseen");
    expect(late).toBe("duplicate");
    const stored = await storedOf(t, learner.userId);
    expect(stored.payments).toEqual([["credits", "refunded"]]);
    expect(stored.lots).toHaveLength(0);
  });
});
