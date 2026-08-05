import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedArticleBucket } from "@/lib/content/article/discovery";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { readPublishedMaterialBucket } from "@/lib/content/material/discovery";
import type { LlmsSection } from "@/lib/llms/constants";
import { buildPublishedContentLlmsEntries } from "@/lib/llms/entries";
import { readMaterialLlmsInventory } from "@/lib/llms/material-pages";
import { readQuranLlmsPageEntries } from "@/lib/llms/quran";

/**
 * Builds entries for one materialized route-catalog page without global reads.
 * Returns null when the requested artifact page has not been materialized.
 */
export const getContentPageLlmsEntries = Effect.fn(
  "www.llms.contentPageEntries"
)(function* ({
  locale,
  page,
  section,
}: {
  locale: Locale;
  page: number;
  section: Exclude<LlmsSection, "site">;
}) {
  if (section === "articles") {
    const published = yield* readPublishedArticleBuckets(locale);
    const bucket = published.buckets[page];
    if (!bucket) {
      return null;
    }
    const partition = yield* readPublishedArticleBucket(locale, bucket);
    if (!partition.articles) {
      return null;
    }
    return buildPublishedContentLlmsEntries({
      locale,
      rows: partition.articles,
      section,
    });
  }

  if (section === "material") {
    const inventory = yield* readMaterialLlmsInventory(locale);
    const bucket = inventory.buckets[page];
    if (!bucket) {
      return null;
    }
    const partition = yield* readPublishedMaterialBucket(
      locale,
      bucket,
      inventory.activeReleaseId
    );
    if (!partition.materials) {
      return null;
    }
    return buildPublishedContentLlmsEntries({
      locale,
      rows: partition.materials,
      section,
    });
  }

  return yield* readQuranLlmsPageEntries(locale, page);
});
