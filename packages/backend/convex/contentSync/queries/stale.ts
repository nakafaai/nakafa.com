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
  "curriculumTopics",
  "curriculumLessons",
  "questionSets",
  "questions"
);

const staleContentIdValidator = v.union(
  v.id("articleContents"),
  v.id("curriculumTopics"),
  v.id("curriculumLessons"),
  v.id("questionSets"),
  v.id("questions")
);

const staleContentItemValidator = v.object({
  id: staleContentIdValidator,
  locale: localeValidator,
  sourcePath: v.string(),
});

/** Return one paginated page of existing content rows for stale-content detection. */
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
      page: page.page.map((item) => {
        const sourcePath = "sourcePath" in item ? item.sourcePath : item.slug;

        return {
          id: item._id,
          locale: item.locale,
          sourcePath,
        };
      }),
    };
  },
});
