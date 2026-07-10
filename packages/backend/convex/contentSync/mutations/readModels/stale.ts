import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";
import { deleteResultValidator } from "./schema";

/** Deletes stale generated public route rows in bounded batches. */
export const deleteStalePublicRoutes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("publicRoutes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});
