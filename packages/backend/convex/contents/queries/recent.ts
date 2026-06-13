import { query } from "@repo/backend/convex/_generated/server";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import type { Infer } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

type RecentlyViewedSubject = Infer<typeof recentlyViewedSubjectValidator>;

/** Returns the current user's recently viewed subjects for one locale. */
export const getRecentlyViewed = query({
  args: {
    locale: localeValidator,
    limit: vv.optional(vv.number()),
  },
  returns: vv.array(recentlyViewedSubjectValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const user = await getOptionalAppUser(ctx);

    if (!user) {
      return [];
    }

    const recentViews = await ctx.db
      .query("contentViews")
      .withIndex(
        "by_userId_and_contentRefType_and_locale_and_lastViewedAt",
        (q) =>
          q
            .eq("userId", user.appUser._id)
            .eq("contentRef.type", "subject")
            .eq("locale", args.locale)
      )
      .order("desc")
      .take(limit);

    if (recentViews.length === 0) {
      return [];
    }

    const subjectViews = recentViews.flatMap((view) => {
      if (view.contentRef.type !== "subject") {
        return [];
      }

      return [
        {
          lastViewedAt: view.lastViewedAt,
          subjectId: view.contentRef.id,
        },
      ];
    });

    if (subjectViews.length === 0) {
      return [];
    }

    const subjects = await getAll(
      ctx.db,
      subjectViews.map((subjectView) => subjectView.subjectId)
    );

    const results: RecentlyViewedSubject[] = [];

    for (const [index, subjectView] of subjectViews.entries()) {
      const subject = subjects[index];

      if (!subject) {
        continue;
      }

      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_route", (q) =>
          q.eq("locale", subject.locale).eq("route", subject.slug)
        )
        .unique();

      if (!route) {
        continue;
      }

      results.push({
        ...buildContentSearchRef(route),
        description: route.description ?? "",
        grade: subject.grade,
        lastViewedAt: subjectView.lastViewedAt,
        material: subject.material,
        title: route.title,
      });
    }

    return results;
  },
});
