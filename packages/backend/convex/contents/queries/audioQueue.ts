import { internalQuery } from "@repo/backend/convex/_generated/server";
import { MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE } from "@repo/backend/convex/audioStudies/constants";
import {
  mergePopularAudioContentItems,
  type PopularAudioContentItem,
  popularAudioContentItemValidator,
} from "@repo/backend/convex/contents/helpers/popularity";
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
