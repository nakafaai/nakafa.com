import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import schema from "@repo/backend/components/betterAuth/schema";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";

/** Rows read by one call: far below the transaction read limit for user rows. */
const PAGE_SIZE = 500;

/**
 * Temporary migration. The `username` plugin of Better Auth is no longer
 * configured, and nothing reads the username it stored. The owner approved the
 * removal of that data on 10 October 2026.
 *
 * One call reads one page of users and removes `username` and
 * `displayUsername` from every row that holds either. Run it until `isDone`,
 * on dev and on production, then run it once more: `cleared` must add up to
 * zero. The two fields then leave the schema, and this module and its test are
 * deleted in that change. A component cannot use the native paginate, so the
 * page comes from the stream helper, as in the deletion module.
 */
export const clearUsernameFields = mutation({
  args: {
    cursor: v.union(v.null(), v.string()),
  },
  returns: v.object({
    cleared: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
    scanned: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await stream(ctx.db, schema)
      .query("user")
      .paginate({ cursor: args.cursor, numItems: PAGE_SIZE });
    let cleared = 0;
    for (const user of page.page) {
      if (user.username !== undefined || user.displayUsername !== undefined) {
        await ctx.db.patch("user", user._id, {
          displayUsername: undefined,
          username: undefined,
        });
        cleared += 1;
      }
    }
    return {
      cleared,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  },
});
