import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";

/**
 * Reset user credits and create transaction record.
 * Idempotent - skips if user.creditsResetAt >= resetTimestamp.
 */
export async function resetUserCredits(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    creditAmount: number;
    grantType: "daily-grant" | "monthly-grant";
    resetTimestamp: number;
  }
) {
  const user = await ctx.db.get("users", args.userId);

  if (!user) {
    throw new Error(`User not found: ${args.userId}`);
  }

  if (user.creditsResetAt >= args.resetTimestamp) {
    logger.info("User credits already reset, skipping", {
      userId: args.userId,
      creditsResetAt: user.creditsResetAt,
      resetTimestamp: args.resetTimestamp,
    });
    return;
  }

  // Calculate new balance accounting for debt
  // If user has negative balance (debt), add it to the new credit amount
  // Example: User has -5 credits, gets 10 credits -> New balance: 10 + (-5) = 5
  const currentBalance = user.credits;
  const debt = currentBalance < 0 ? currentBalance : 0;
  const newBalance = args.creditAmount + debt;

  await ctx.db.patch("users", args.userId, {
    credits: newBalance,
    creditsResetAt: args.resetTimestamp,
  });

  await ctx.db.insert("creditTransactions", {
    userId: args.userId,
    amount: args.creditAmount,
    type: args.grantType,
    balanceAfter: newBalance,
    metadata: {
      previousBalance: currentBalance,
      debtAdjustment: debt,
      baseGrant: args.creditAmount,
    },
  });

  logger.info("User credits reset", {
    userId: args.userId,
    baseGrant: args.creditAmount,
    debtAdjustment: debt,
    newBalance,
    previousBalance: currentBalance,
    type: args.grantType,
  });
}
