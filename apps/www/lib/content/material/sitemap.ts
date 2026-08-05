import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads non-empty material sitemap partitions for one localized catalog. */
export const readPublishedMaterialBuckets = Effect.fn(
  "www.materials.readSitemapBuckets"
)(function* (locale: Locale, expectedActiveReleaseId?: ContentReleasePin) {
  const result = yield* readRuntimeQuery(
    "contentRelease.material.sitemapBuckets",
    () =>
      fetchRuntimeQuery(api.contentRelease.material.sitemapBuckets, { locale })
  );
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    expectedActiveReleaseId,
    { locale, publicPath: "materials" }
  );
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      locale,
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
  return yield* readRuntimeQuery("contentRelease.material.sitemapPage", () =>
    fetchRuntimeQuery(api.contentRelease.material.sitemapPage, {
      bucket,
      locale,
    })
  );
});
