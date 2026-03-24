import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getAll } from "convex-helpers/server/relationships";

/**
 * Get recently viewed subjects for the current user.
 *
 * Returns the most recently viewed subjects, sorted by lastViewedAt descending.
 * Limited to the specified limit (default: 5).
 */
export const getRecentlyViewed = query({
  args: {
    locale: localeValidator,
    limit: vv.optional(vv.number()),
  },
  returns: vv.array(recentlyViewedSubjectValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    // Get current user
    const user = await getOptionalAppUser(ctx);
    if (!user) {
      return [];
    }

    const recentViewsQuery = ctx.db
      .query("contentViews")
      .withIndex(
        "by_userId_and_contentRefType_and_locale_and_lastViewedAt",
        (q) =>
          q
            .eq("userId", user.appUser._id)
            .eq("contentRef.type", "subject")
            .eq("locale", args.locale)
      )
      .order("desc");

    const recentViews = await recentViewsQuery.take(limit);

    if (recentViews.length === 0) {
      return [];
    }

    const subjectViews: Array<{
      lastViewedAt: number;
      slug: string;
      subjectId: Id<"subjectSections">;
    }> = [];

    for (const view of recentViews) {
      if (view.contentRef.type !== "subject") {
        continue;
      }

      subjectViews.push({
        lastViewedAt: view.lastViewedAt,
        slug: view.slug,
        subjectId: view.contentRef.id,
      });
    }

    if (subjectViews.length === 0) {
      return [];
    }

    const subjects = await getAll(
      ctx.db,
      subjectViews.map((subjectView) => subjectView.subjectId)
    );

    return subjectViews.flatMap((subjectView, index) => {
      const subject = subjects[index];

      if (!subject) {
        return [];
      }

      return {
        id: subject._id,
        title: subject.title,
        description: subject.description,
        slug: subjectView.slug,
        grade: subject.grade,
        material: subject.material,
        lastViewedAt: subjectView.lastViewedAt,
      };
    });
  },
});
