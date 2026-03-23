import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { safeGetAppUser } from "@repo/backend/convex/auth";
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
    const user = await safeGetAppUser(ctx);
    if (!user) {
      return [];
    }

    const recentViewsQuery = ctx.db
      .query("contentViews")
      .withIndex("userId_type_locale_lastViewedAt", (q) =>
        q
          .eq("userId", user.appUser._id)
          .eq("contentRef.type", "subject")
          .eq("locale", args.locale)
      )
      .order("desc");

    const seenSubjects = new Set<string>();
    const limitedViews: Doc<"contentViews">[] = [];

    for await (const view of recentViewsQuery) {
      if (view.contentRef.type !== "subject") {
        continue;
      }

      if (seenSubjects.has(view.contentRef.id)) {
        continue;
      }

      seenSubjects.add(view.contentRef.id);
      limitedViews.push(view);

      if (limitedViews.length === limit) {
        break;
      }
    }

    if (limitedViews.length === 0) {
      return [];
    }

    // Extract subject IDs and batch fetch using convex-helpers
    const subjectIds = limitedViews
      .map((view) =>
        view.contentRef.type === "subject" ? view.contentRef.id : null
      )
      .filter((id) => id !== null);

    const subjects = await getAll(ctx.db, subjectIds);

    // Map to results maintaining order from limitedViews
    const results = limitedViews
      .map((view, index) => {
        const subject = subjects[index];
        if (!subject || view.contentRef.type !== "subject") {
          return null;
        }
        return {
          id: subject._id,
          title: subject.title,
          description: subject.description,
          slug: view.slug,
          grade: subject.grade,
          material: subject.material,
          lastViewedAt: view.lastViewedAt,
        };
      })
      .filter((subject) => subject !== null);

    return results;
  },
});
