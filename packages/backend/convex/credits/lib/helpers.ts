import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

/**
 * Check if user has sufficient credits.
 * Throws error if insufficient.
 */
export async function requireCredits(
  ctx: MutationCtx,
  userId: Id<"users">,
  cost: number
): Promise<void> {
  const user = await ctx.db.get("users", userId);

  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: "User not found",
    });
  }

  const currentCredits = user.credits ?? 0;

  if (currentCredits < cost) {
    throw new ConvexError({
      code: "INSUFFICIENT_CREDITS",
      message: `Insufficient credits. Required: ${cost}, Available: ${currentCredits}`,
      data: {
        required: cost,
        available: currentCredits,
      },
    });
  }
}
