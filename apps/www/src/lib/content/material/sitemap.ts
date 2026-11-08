import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeContentRelease } from "@/lib/content/published/release";
import {
  queryContentStore,
  queryPinnedContentStore,
} from "@/lib/content/store/query";

/** Reads non-empty material sitemap partitions for one localized catalog. */
export const readPublishedMaterialBuckets = Effect.fn(
  "www.materials.readSitemapBuckets"
)(function* (locale: Locale, release?: ActiveContentReleaseId) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryPinnedContentStore(
    release,
    contentRelease.material.sitemapBuckets,
    { appLocale }
  );
  const activeReleaseId = yield* decodeContentRelease(result.activeReleaseId, {
    appLocale,
    publicPath: "materials",
  });
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "sitemap.xml",
    });
  }
  return {
    activeReleaseId,
    buckets: result.buckets,
    materialCount: result.materialCount,
  };
});

/** Reads one complete verified material sitemap partition. */
export const readPublishedMaterialSitemap = Effect.fn(
  "www.materials.readSitemapPage"
)(function* (
  locale: Locale,
  bucket: Ref.Args<typeof contentRelease.material.sitemapPage>["bucket"]
) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* queryContentStore(contentRelease.material.sitemapPage, {
    appLocale,
    bucket,
  });
});
