import { query } from "@repo/backend/convex/_generated/server";
import { safeGetAppUser } from "@repo/backend/convex/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { getAll } from "convex-helpers/server/relationships";

/**
 * Get recently viewed subjects for the current user.
 *
 * Returns the most recently viewed subjects, sorted by viewedAt descending.
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

    // Fetch recent views for this user using index
    // Uses userId_type_viewedAt index for efficient querying
    const recentViews = await ctx.db
      .query("contentViews")
      .withIndex("userId_type_viewedAt", (q) =>
        q.eq("userId", user.appUser._id).eq("contentRef.type", "subject")
      )
      .order("desc")
      .take(limit * 2); // Take more to handle potential duplicates

    // Remove duplicates (keep most recent view per subject)
    const seenSubjects = new Set<string>();
    const uniqueViews = recentViews.filter((view) => {
      // Type is already filtered by index, but we need to narrow for TypeScript
      if (view.contentRef.type !== "subject") {
        return false;
      }
      const subjectId = view.contentRef.id;
      if (seenSubjects.has(subjectId)) {
        return false;
      }
      seenSubjects.add(subjectId);
      return true;
    });

    // Limit to requested amount after deduplication
    const limitedViews = uniqueViews.slice(0, limit);

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
          viewedAt: view.viewedAt,
        };
      })
      .filter((subject) => subject !== null);

    return results;
  },
});
