import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE } from "@repo/backend/convex/audioStudies/constants";
import {
  mergePopularAudioContentItems,
  type PopularAudioContentItem,
  popularAudioContentItemValidator,
} from "@repo/backend/convex/contents/helpers/popularity";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

/**
 * Returns the current top article and subject candidates for audio generation.
 *
 * This query is used by an internal action so popularity reads never happen
 * inside the mutation that writes audio queue rows.
 */
export const getPopularContentForAudioQueue = internalQuery({
  args: {},
  returns: v.array(popularAudioContentItemValidator),
  handler: async (ctx) => {
    const [articleRows, subjectRows] = await Promise.all([
      ctx.db
        .query("articlePopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
      ctx.db
        .query("subjectPopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
    ]);

    const popularItems: PopularAudioContentItem[] = [
      ...articleRows.map(
        (row) =>
          ({
            ref: { type: "article", id: row.contentId },
            viewCount: row.viewCount,
          }) satisfies PopularAudioContentItem
      ),
      ...subjectRows.map(
        (row) =>
          ({
            ref: { type: "subject", id: row.contentId },
            viewCount: row.viewCount,
          }) satisfies PopularAudioContentItem
      ),
    ];

    return mergePopularAudioContentItems(popularItems);
  },
});

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
