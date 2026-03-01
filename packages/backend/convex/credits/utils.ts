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
    previousBalance: number;
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

  await ctx.db.patch("users", args.userId, {
    credits: args.creditAmount,
    creditsResetAt: args.resetTimestamp,
  });

  await ctx.db.insert("creditTransactions", {
    userId: args.userId,
    amount: args.creditAmount,
    type: args.grantType,
    balanceAfter: args.creditAmount,
    metadata: {
      previousBalance: args.previousBalance,
    },
  });

  logger.info("User credits reset", {
    userId: args.userId,
    amount: args.creditAmount,
    type: args.grantType,
  });
}
