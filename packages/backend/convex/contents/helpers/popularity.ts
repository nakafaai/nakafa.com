import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import type { popularAudioContentItemValidator } from "@repo/backend/convex/contents/validators";
import type { Infer } from "convex/values";

export type PopularAudioContentItem = Infer<
  typeof popularAudioContentItemValidator
>;

/** Deduplicates and ranks popularity rows for audio queue consumption. */
export function mergePopularAudioContentItems(
  items: PopularAudioContentItem[]
) {
  const mergedItems = new Map<string, PopularAudioContentItem>();

  for (const item of items) {
    const key = `${item.ref.type}:${item.ref.id}`;
    const existingItem = mergedItems.get(key);

    if (!existingItem) {
      mergedItems.set(key, {
        ref: item.ref,
        viewCount: item.viewCount,
      });
      continue;
    }

    existingItem.viewCount += item.viewCount;
  }

  return Array.from(mergedItems.values())
    .filter((item) => item.viewCount >= MIN_VIEW_THRESHOLD)
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE * 2);
}
