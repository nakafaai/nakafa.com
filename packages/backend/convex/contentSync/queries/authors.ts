import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const authorSummaryValidator = v.object({
  id: v.string(),
  name: v.string(),
  username: v.string(),
});

export const listAuthorsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(authorSummaryValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("authors").paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((author) => ({
        id: author._id,
        name: author.name,
        username: author.username,
      })),
    };
  },
});
