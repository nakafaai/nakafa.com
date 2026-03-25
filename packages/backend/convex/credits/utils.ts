import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { CreditTransactionType } from "@repo/backend/convex/credits/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError } from "convex/values";

/**
 * Reset user credits and create transaction record.
 * Idempotent - skips if user.creditsResetAt >= resetTimestamp.
 */
export async function resetUserCredits(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    creditAmount: number;
    grantType: CreditTransactionType;
    resetTimestamp: number;
  }
) {
  const user = await ctx.db.get("users", args.userId);

  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: `User not found: ${args.userId}`,
    });
  }

  if (user.creditsResetAt >= args.resetTimestamp) {
    logger.info("User credits already reset, skipping", {
      userId: args.userId,
      creditsResetAt: user.creditsResetAt,
      resetTimestamp: args.resetTimestamp,
    });
    return;
  }

  // Calculate new balance accounting for debt.
  // If user has a negative balance (debt from post-stream deductions), carry it forward
  // so the reset grant partially offsets it.
  // Example: balance = -5, grant = 10 → new balance = 5
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
