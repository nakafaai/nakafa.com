import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import { getAudioContentSourceByRoute } from "@repo/backend/convex/audioStudies/helpers/sources";
import { mergePopularAudioContentItems } from "@repo/backend/convex/contents/helpers/popularity";
import {
  type PopularAudioContentItem,
  popularAudioContentItemValidator,
} from "@repo/backend/convex/contents/validators";
import { v } from "convex/values";

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
        .query("learningPopularity")
        .withIndex("by_section_and_viewCount_and_content_id", (q) =>
          q.eq("section", "articles").gte("viewCount", MIN_VIEW_THRESHOLD)
        )
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
      ctx.db
        .query("learningPopularity")
        .withIndex("by_section_and_viewCount_and_content_id", (q) =>
          q.eq("section", "subject").gte("viewCount", MIN_VIEW_THRESHOLD)
        )
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
    ]);
    const sourceItems: PopularAudioContentItem[] = [];

    for (const row of articleRows) {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", row.content_id))
        .unique();

      if (route?.kind !== "article" || route.content_id !== route.assetId) {
        continue;
      }

      const sourceContent = await getAudioContentSourceByRoute(ctx, route);

      if (!sourceContent) {
        continue;
      }

      sourceItems.push({
        sourceContent,
        viewCount: row.viewCount,
      });
    }

    for (const row of subjectRows) {
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", row.content_id))
        .unique();

      if (
        route?.kind !== "subject-section" ||
        route.content_id !== route.assetId
      ) {
        continue;
      }

      const sourceContent = await getAudioContentSourceByRoute(ctx, route);

      if (!sourceContent) {
        continue;
      }

      sourceItems.push({
        sourceContent,
        viewCount: row.viewCount,
      });
    }

    return mergePopularAudioContentItems(sourceItems);
  },
});
