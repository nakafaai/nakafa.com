import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { v } from "convex/values";

/** Rows read by one call: far below the transaction read limit for user rows. */
const PAGE_SIZE = 500;

/**
 * Temporary migration. The `username` plugin of Better Auth is no longer
 * configured, and its two user fields leave the schema. A row that still
 * holds an empty value in one of them must lose the field first, or the new
 * schema is refused.
 *
 * One call reads one page of users. It removes both fields from a row that
 * holds no text in either, and it only counts a row that holds text: a
 * stored username is a person's data, and removing it is a separate decision.
 * Run it until `isDone`, on dev and on production. When `text` adds up to
 * zero, the fields and their index can leave the schema, and this module and
 * its test are deleted in that change.
 */
export const clearEmptyUsernameFields = mutation({
  args: {
    cursor: v.union(v.null(), v.string()),
  },
  returns: v.object({
    cleared: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
    scanned: v.number(),
    text: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("user")
      .paginate({ cursor: args.cursor, numItems: PAGE_SIZE });
    let cleared = 0;
    let text = 0;
    for (const user of page.page) {
      if (
        typeof user.username === "string" ||
        typeof user.displayUsername === "string"
      ) {
        text += 1;
      } else if (
        user.username !== undefined ||
        user.displayUsername !== undefined
      ) {
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
      text,
    };
  },
});
