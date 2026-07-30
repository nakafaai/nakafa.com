import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedArticleBucket } from "@/lib/content/article/discovery";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { readPublishedMaterialBucket } from "@/lib/content/material/discovery";
import { getRuntimeContentRouteArtifactPage } from "@/lib/content/runtime/routes";
import type { LlmsSection } from "@/lib/llms/constants";
import {
  buildPublishedContentLlmsEntries,
  buildRuntimeContentLlmsEntries,
} from "@/lib/llms/entries";
import { reconcileMaterialLlmsRows } from "@/lib/llms/material";
import { readMaterialLlmsInventory } from "@/lib/llms/material-pages";

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
    if (published.managed) {
      const bucket = published.buckets[page];
      if (!bucket) {
        return null;
      }
      const partition = yield* readPublishedArticleBucket(locale, bucket);
      if (!(partition.managed && partition.articles)) {
        return null;
      }
      return buildPublishedContentLlmsEntries({
        locale,
        rows: partition.articles,
        section,
      });
    }
  }

  if (section === "material") {
    const inventory = yield* readMaterialLlmsInventory(locale);
    const publishedPage = page - inventory.sourcePageCount;
    if (publishedPage >= 0 && inventory.owner !== "source") {
      const bucket = inventory.buckets[publishedPage];
      if (!bucket) {
        return null;
      }
      const partition = yield* readPublishedMaterialBucket(
        locale,
        bucket,
        inventory.activeReleaseId
      );
      if (!(partition.managed && partition.materials)) {
        return null;
      }
      return buildPublishedContentLlmsEntries({
        locale,
        rows: partition.materials,
        section,
      });
    }
    const artifactPage = yield* getRuntimeContentRouteArtifactPage({
      locale,
      page,
      section,
    });
    if (!artifactPage) {
      return null;
    }
    const rows = yield* reconcileMaterialLlmsRows(
      locale,
      artifactPage.routes,
      inventory.activeReleaseId
    );
    return buildRuntimeContentLlmsEntries({
      locale,
      rows,
      section,
    });
  }

  const artifactPage = yield* getRuntimeContentRouteArtifactPage({
    locale,
    page,
    section,
  });
  if (!artifactPage) {
    return null;
  }
  return buildRuntimeContentLlmsEntries({
    locale,
    rows: artifactPage.routes,
    section,
  });
});
