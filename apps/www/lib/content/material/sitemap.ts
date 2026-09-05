import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/content/material/sitemap";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads non-empty material sitemap partitions for one localized catalog. */
export const readPublishedMaterialBuckets = Effect.fn(
  "www.materials.readSitemapBuckets"
)(function* (locale: Locale, expectedActiveReleaseId?: ContentReleasePin) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.sitemapBuckets,
    { appLocale },
    (queryArgs) => readMaterialBuckets(queryArgs.appLocale)
  );
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    expectedActiveReleaseId,
    { appLocale, publicPath: "materials" }
  );
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
)(function* (locale: Locale, bucket: string) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* readRuntimeQuery(
    api.contentRelease.material.sitemapPage,
    {
      appLocale,
      bucket,
    },
    (queryArgs) => readMaterialSitemap(queryArgs.appLocale, queryArgs.bucket)
  );
});
