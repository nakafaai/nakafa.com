import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/**
 * Deletes one bounded batch of a user's try-out rows and reports whether more
 * remain. Temporary admin path used once to retire learner rows that still
 * referenced the retired signed snapshot encoding; removed after the drain.
 */
export const retireFrozenTryouts = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(cleanupUserTryouts(ctx, args.userId)),
});
