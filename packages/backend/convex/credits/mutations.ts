import {
  getCurrentCreditResetTimestamp,
  upsertStoredCreditResetTimestamp,
} from "@repo/backend/convex/credits/helpers/state";
import { internalMutation } from "@repo/backend/convex/functions";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import { v } from "convex/values";

/** Synchronizes one plan's materialized reset boundary with the current time. */
export const syncCreditResetPeriod = internalMutation({
  args: {
    plan: userPlanValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertStoredCreditResetTimestamp(
      ctx.db,
      args.plan,
      getCurrentCreditResetTimestamp(args.plan, Date.now())
    );

    return null;
  },
});

/** Seeds or refreshes all materialized credit reset boundaries. */
export const syncAllCreditResetPeriods = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    await upsertStoredCreditResetTimestamp(
      ctx.db,
      "free",
      getCurrentCreditResetTimestamp("free", now)
    );
    await upsertStoredCreditResetTimestamp(
      ctx.db,
      "pro",
      getCurrentCreditResetTimestamp("pro", now)
    );

    return null;
  },
});
