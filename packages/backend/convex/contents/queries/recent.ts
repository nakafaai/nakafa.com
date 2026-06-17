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
          .eq("section", "material")
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

      if (route?.kind !== "curriculum-lesson") {
        continue;
      }

      if (!route.materialDomain) {
        continue;
      }

      results.push({
        ...toPublicContentRef(route),
        description: route.description ?? "",
        lastViewedAt: view.lastViewedAt,
        materialDomain: route.materialDomain,
        title: route.title,
      });
    }

    return results;
  },
});

/** Exposes only public content-ref fields accepted by the recent-view validator. */
function toPublicContentRef(
  route: Parameters<typeof buildContentSearchRef>[0]
) {
  const ref = buildContentSearchRef(route);

  return {
    alignmentId: ref.alignmentId,
    assetId: ref.assetId,
    conceptId: ref.conceptId,
    content_id: ref.content_id,
    learningObjectId: ref.learningObjectId,
    lensId: ref.lensId,
    locale: ref.locale,
    markdown_url: ref.markdown_url,
    route: ref.route,
    section: ref.section,
    url: ref.url,
  };
}
