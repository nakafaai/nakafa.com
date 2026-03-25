import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { ConvexError } from "convex/values";

/** Load one tryout attempt and verify the authenticated user owns it. */
export async function requireOwnedTryoutAttempt(
  ctx: MutationCtx,
  {
    tryoutAttemptId,
    userId,
  }: {
    tryoutAttemptId: Id<"tryoutAttempts">;
    userId: Id<"users">;
  }
) {
  const tryoutAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "ATTEMPT_NOT_FOUND",
      message: "Tryout attempt not found.",
    });
  }

  if (tryoutAttempt.userId !== userId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this tryout attempt.",
    });
  }

  return tryoutAttempt;
}

/** Sync expiry first, then return the latest in-progress attempt snapshot. */
export async function requireActiveTryoutAttemptAfterExpirySync(
  ctx: MutationCtx,
  {
    now,
    tryoutAttempt,
  }: {
    now: number;
    tryoutAttempt: Doc<"tryoutAttempts">;
  }
) {
  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (tryoutExpiry.expired) {
    throw new ConvexError({
      code: "TRYOUT_EXPIRED",
      message: "This tryout has expired.",
      expiresAtMs: tryoutExpiry.expiredAtMs,
    });
  }

  const currentTryoutAttempt = await ctx.db.get(
    "tryoutAttempts",
    tryoutAttempt._id
  );

  if (!currentTryoutAttempt) {
    throw new ConvexError({
      code: "ATTEMPT_NOT_FOUND",
      message: "Tryout attempt not found.",
    });
  }

  if (currentTryoutAttempt.status !== "in-progress") {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATUS",
      message: "Tryout attempt is not in progress.",
    });
  }

  return currentTryoutAttempt;
}
