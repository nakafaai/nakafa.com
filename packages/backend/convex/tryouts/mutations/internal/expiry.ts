import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { scheduleExpiredTryoutAttempts } from "@repo/backend/convex/tryouts/expiry/impl";
import { expireTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/expiry";
import { v } from "convex/values";

/** Scheduler-safe expiry for one in-progress tryout attempt. */
export const expireTryoutAttemptInternal = internalMutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    expiresAtMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (tryoutAttempt?.status !== "in-progress") {
      return null;
    }

    if (
      args.expiresAtMs < tryoutAttempt.expiresAt ||
      now < tryoutAttempt.expiresAt
    ) {
      return null;
    }

    await expireTryoutAttempt(ctx, tryoutAttempt, now);
    return null;
  },
});

/**
 * Repair overdue in-progress tryouts in bounded batches.
 *
 * This sweep only schedules overdue attempts. The actual finalization runs in
 * one transaction per attempt to keep OCC conflict scope small.
 * @see https://docs.convex.dev/database/advanced/occ
 */
export const sweepExpiredTryoutAttempts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await runConvexProgram(
      scheduleExpiredTryoutAttempts(ctx, {
        expireTryoutAttempt:
          internal.tryouts.mutations.internal.expiry
            .expireTryoutAttemptInternal,
      })
    );

    return null;
  },
});
