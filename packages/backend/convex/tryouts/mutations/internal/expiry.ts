import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  expireTryoutAttempt,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers/expiry";
import { v } from "convex/values";

const TRYOUT_EXPIRY_SWEEP_BATCH_SIZE = 100;

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

    if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
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
 * The exact expiry still comes from the per-attempt scheduled mutation. This
 * sweep only cleans up any overdue attempts whose scheduled expiration was
 * delayed or missed.
 */
export const sweepExpiredTryoutAttempts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const inProgressAttempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", now + 1)
      )
      .take(TRYOUT_EXPIRY_SWEEP_BATCH_SIZE);

    for (const tryoutAttempt of inProgressAttempts) {
      await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);
    }

    if (inProgressAttempts.length < TRYOUT_EXPIRY_SWEEP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.mutations.internal.expiry.sweepExpiredTryoutAttempts,
      {}
    );

    return null;
  },
});
