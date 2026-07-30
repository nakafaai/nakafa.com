import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { decodeMaterialReleasePin } from "@/lib/content/material/release";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads non-empty material sitemap partitions for one localized catalog. */
export const readPublishedMaterialBuckets = Effect.fn(
  "www.materials.readSitemapBuckets"
)(function* (locale: Locale) {
  const result = yield* readRuntimeQuery(
    "contentRelease.material.sitemapBuckets",
    () =>
      fetchRuntimeQuery(api.contentRelease.material.sitemapBuckets, { locale })
  );
  const activeReleaseId = yield* decodeMaterialReleasePin(
    result.activeReleaseId,
    undefined,
    { locale, publicPath: "materials" }
  );
  return { ...result, activeReleaseId };
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
