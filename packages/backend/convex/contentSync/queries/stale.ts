import { internalQuery } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const staleContentTableNameValidator = literals(
  "articleContents",
  "subjectTopics",
  "subjectSections",
  "exerciseSets",
  "exerciseQuestions"
);

const staleContentIdValidator = v.union(
  v.id("articleContents"),
  v.id("subjectTopics"),
  v.id("subjectSections"),
  v.id("exerciseSets"),
  v.id("exerciseQuestions")
);

const staleContentItemValidator = v.object({
  id: staleContentIdValidator,
  locale: localeValidator,
  slug: v.string(),
});

export const listStaleContentPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    tableName: staleContentTableNameValidator,
  },
  returns: paginationResultValidator(staleContentItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.tableName)
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((item) => ({
        id: item._id,
        locale: item.locale,
        slug: item.slug,
      })),
    };
  },
});
