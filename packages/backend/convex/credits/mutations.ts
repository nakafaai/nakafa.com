import {
  getCurrentCreditResetTimestamp,
  getEffectiveCreditState,
} from "@repo/backend/convex/credits/constants";
import { creditTransactionTypeValidator } from "@repo/backend/convex/credits/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import { ConvexError, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Applies one serialized credit balance change and writes the matching ledger row. */
export const applyCreditBalanceEvent = internalMutation({
  args: {
    amount: v.number(),
    eventType: literals("plan-change", "usage"),
    metadata: v.optional(v.record(v.string(), v.any())),
    plan: v.optional(userPlanValidator),
    resetTimestamp: v.optional(v.number()),
    transactionType: v.optional(creditTransactionTypeValidator),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    const now = Date.now();
    const effectiveState = getEffectiveCreditState(user, now);

    if (args.eventType === "usage") {
      const newBalance = effectiveState.credits - args.amount;

      await ctx.db.patch("users", args.userId, {
        credits: newBalance,
        creditsResetAt: effectiveState.creditsResetAt,
      });

      await ctx.db.insert("creditTransactions", {
        userId: args.userId,
        amount: -args.amount,
        type: "usage",
        balanceAfter: newBalance,
        metadata: args.metadata,
      });

      return null;
    }

    if (!args.plan) {
      throw new ConvexError({
        code: "CREDIT_PLAN_MISSING",
        message: "Plan-change events require a plan.",
      });
    }

    const nextResetTimestamp =
      args.resetTimestamp ?? getCurrentCreditResetTimestamp(args.plan, now);
    const nextCredits =
      args.resetTimestamp === undefined ? effectiveState.credits : args.amount;

    if (
      user.plan === args.plan &&
      user.credits === nextCredits &&
      user.creditsResetAt === nextResetTimestamp
    ) {
      return null;
    }

    await ctx.db.patch("users", args.userId, {
      plan: args.plan,
      credits: nextCredits,
      creditsResetAt: nextResetTimestamp,
    });

    if (!args.transactionType) {
      return null;
    }

    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      amount: args.amount,
      type: args.transactionType,
      balanceAfter: nextCredits,
      metadata: args.metadata,
    });

    return null;
  },
});
