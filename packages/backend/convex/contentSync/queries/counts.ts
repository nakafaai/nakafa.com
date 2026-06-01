import { internalQuery } from "@repo/backend/convex/_generated/server";
import { contentCountTableNames } from "@repo/backend/convex/contentSync/tables";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const countableTableNameValidator = literals(...contentCountTableNames);

const countTablePageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  pageSize: v.number(),
});

/** Returns the size of one paginated table slice for sync verification scripts. */
export const countTablePage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    tableName: countableTableNameValidator,
  },
  returns: countTablePageResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.tableName)
      .paginate(args.paginationOpts);

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      pageSize: page.page.length,
    };
  },
});
