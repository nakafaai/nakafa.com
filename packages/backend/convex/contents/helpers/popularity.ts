import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import type { PopularAudioContentItem } from "@repo/backend/convex/contents/validators";

/** Deduplicates and ranks popularity rows for audio queue consumption. */
export function mergePopularAudioContentItems(
  items: PopularAudioContentItem[]
) {
  const mergedItems = new Map<string, PopularAudioContentItem>();

  for (const item of items) {
    const key = item.sourceContent
      ? `${item.sourceContent.ref.type}:${item.sourceContent.slug}`
      : `${item.ref.type}:${item.ref.id}`;
    const existingItem = mergedItems.get(key);

    if (!existingItem || item.viewCount > existingItem.viewCount) {
      mergedItems.set(key, {
        ref: item.ref,
        sourceContent: item.sourceContent,
        viewCount: item.viewCount,
      });
    }
  }

  return Array.from(mergedItems.values())
    .filter((item) => item.viewCount >= MIN_VIEW_THRESHOLD)
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE * 2);
}
