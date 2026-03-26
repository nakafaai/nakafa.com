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

    return mergePopularAudioContentItems([
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
    ]);
  },
});

/**
 * Returns the current user's recently viewed subjects for one locale.
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
          slug: view.slug,
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
