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
  "questions",
  "tryoutCountries",
  "tryoutExams",
  "tryoutSets",
  "tryoutSections"
);

const staleContentIdValidator = v.union(
  v.id("articleContents"),
  v.id("curriculumTopics"),
  v.id("curriculumLessons"),
  v.id("questionSets"),
  v.id("questions"),
  v.id("tryoutCountries"),
  v.id("tryoutExams"),
  v.id("tryoutSets"),
  v.id("tryoutSections")
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
      page: page.page.map((item) => ({
        id: item._id,
        locale: item.locale,
        sourcePath: getStaleSourcePath(item),
      })),
    };
  },
});

/** Returns the source identity used for stale content comparison. */
function getStaleSourcePath(item: {
  publicPath?: string;
  slug?: string;
  sourcePath?: string;
}) {
  if (item.sourcePath) {
    return item.sourcePath;
  }

  if (item.publicPath) {
    return item.publicPath;
  }

  return item.slug ?? "";
}
