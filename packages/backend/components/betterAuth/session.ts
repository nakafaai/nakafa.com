import { query } from "@repo/backend/components/betterAuth/_generated/server";
import { v } from "convex/values";

/**
 * Says whether a session is live for a user at `now`: the session exists, has
 * not expired and belongs to that user, and the user still exists. Every write
 * asks this before it runs, so the module imports no Better Auth code: the
 * adapter loads the whole library on each call, and this reads two rows by
 * their ids.
 */
export const live = query({
  args: { now: v.number(), sessionId: v.string(), userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("session", args.sessionId);
    const userId = ctx.db.normalizeId("user", args.userId);
    if (!(sessionId && userId)) {
      return false;
    }
    const session = await ctx.db.get("session", sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.expiresAt <= args.now
    ) {
      return false;
    }
    const user = await ctx.db.get("user", userId);
    return user !== null;
  },
});
