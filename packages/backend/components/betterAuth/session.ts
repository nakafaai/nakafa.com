import { query } from "@repo/backend/components/betterAuth/_generated/server";
import { v } from "convex/values";

/**
 * Says whether a session is live for a user at `now`: the session exists, has
 * not expired and belongs to that user, and the user still exists. Every write
 * asks this before it runs, so the module imports no Better Auth code and reads
 * two rows by their ids. Measured on 12 October 2026: its bundle is 56 KiB
 * against 2,830 KiB for the adapter's module (the Convex CLI's bundler
 * options), and production ran one adapter lookup in 327 to 615 ms.
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
    // The comparison is the positive one, so a `now` that is not a number
    // makes no session live.
    const unexpired = session !== null && session.expiresAt > args.now;
    if (!(unexpired && session.userId === userId)) {
      return false;
    }
    const user = await ctx.db.get("user", userId);
    return user !== null;
  },
});
