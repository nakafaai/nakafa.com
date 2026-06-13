import { query } from "@repo/backend/convex/_generated/server";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import type { Infer } from "convex/values";

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
      .withIndex("by_userId_and_section_and_locale_and_lastViewedAt", (q) =>
        q
          .eq("userId", user.appUser._id)
          .eq("section", "subject")
          .eq("locale", args.locale)
      )
      .order("desc")
      .take(limit);

    if (recentViews.length === 0) {
      return [];
    }

    const results: RecentlyViewedSubject[] = [];

    for (const view of recentViews) {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", view.content_id))
        .unique();

      if (route?.kind !== "subject-section") {
        continue;
      }

      const subject = await ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", route.locale).eq("slug", route.route)
        )
        .unique();

      if (!subject) {
        continue;
      }

      results.push({
        ...buildContentSearchRef(route),
        description: route.description ?? "",
        grade: subject.grade,
        lastViewedAt: view.lastViewedAt,
        material: subject.material,
        title: route.title,
      });
    }

    return results;
  },
});
